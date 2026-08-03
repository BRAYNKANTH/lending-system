import db from '../db.js';

/**
 * Records a cash payment collection from a borrower — either an interest
 * payment (clears interest_balance, never closes the loan) or a principal
 * payment (clears principal_outstanding, closes the loan once it hits 0
 * regardless of any interest still owed). These are deliberately separate:
 * this is an interest-only lending model — principal stays fixed until
 * explicitly repaid, and periodic interest is a recurring charge on top of it.
 * Executed inside a single transaction with row-level locks.
 */
export async function recordPaymentCollection({ loanId, agentId, amount, paymentType, notes, proofImageUrl, idempotencyKey, paymentMethod }) {
  return await db.transaction(async (trx) => {
    // 1. Lock the loan row to prevent concurrent updates (Double payments)
    const loan = await trx('loans')
      .where({ id: loanId })
      .first()
      .forUpdate();

    if (!loan) {
      throw new Error('Loan not found.');
    }

    if (loan.status === 'fully_paid') {
      throw new Error('This loan has already been fully paid.');
    }

    if (loan.status === 'defaulted') {
      throw new Error('This loan is defaulted. Payments cannot be posted directly without clearance.');
    }

    const payAmount = parseFloat(amount);
    const principalOutstanding = parseFloat(loan.principal_outstanding);
    const interestBalance = parseFloat(loan.interest_balance);

    if (paymentType === 'interest') {
      if (payAmount > interestBalance) {
        throw new Error(`Interest payment (LKR ${payAmount.toLocaleString()}) exceeds outstanding interest due (LKR ${interestBalance.toLocaleString()}).`);
      }
    } else if (paymentType === 'principal') {
      if (payAmount > principalOutstanding) {
        throw new Error(`Principal payment (LKR ${payAmount.toLocaleString()}) exceeds outstanding principal (LKR ${principalOutstanding.toLocaleString()}).`);
      }
    } else {
      throw new Error("Payment type must be 'interest' or 'principal'.");
    }

    // 2. Insert transaction entry
    const [transaction] = await trx('transactions')
      .insert({
        loan_id: loanId,
        agent_id: agentId,
        borrower_id: loan.borrower_id,
        amount: payAmount,
        payment_type: paymentType,
        notes: notes || '',
        proof_image_url: proofImageUrl || null,
        payment_method: paymentMethod || 'cash',
        idempotency_key: idempotencyKey
      })
      .returning('*');

    // 3. Post double-entry ledger entries. loan_receivable represents the
    // client's total amount owed (principal + unpaid interest combined) —
    // either payment type clears part of that same receivable, so the
    // ledger posting is identical; only the loan's own bookkeeping below
    // distinguishes which component was paid down.
    // A: Debit cash_agent (Asset increases)
    // B: Credit loan_receivable (Asset decreases)
    await trx('ledger_entries').insert([
      {
        loan_id: loanId,
        transaction_id: transaction.id || transaction,
        account: 'cash_agent',
        type: 'debit',
        amount: payAmount
      },
      {
        loan_id: loanId,
        transaction_id: transaction.id || transaction,
        account: 'loan_receivable',
        type: 'credit',
        amount: payAmount
      }
    ]);

    // 4. Update the loan's principal/interest bookkeeping
    let newPrincipalOutstanding = principalOutstanding;
    let newInterestBalance = interestBalance;
    let newStatus = loan.status;

    if (paymentType === 'interest') {
      newInterestBalance = interestBalance - payAmount;
    } else {
      newPrincipalOutstanding = principalOutstanding - payAmount;
      if (newPrincipalOutstanding <= 0) {
        newStatus = 'fully_paid';
      }
    }

    await trx('loans')
      .where({ id: loanId })
      .update({
        principal_outstanding: newPrincipalOutstanding,
        interest_balance: newInterestBalance,
        status: newStatus,
        updated_at: db.fn.now()
      });

    // 5. Create audit log
    const description = paymentType === 'interest'
      ? `Collected interest payment of LKR ${payAmount.toLocaleString()} for Loan ID ${loanId}. Interest still due: LKR ${newInterestBalance.toLocaleString()}.`
      : `Collected principal payment of LKR ${payAmount.toLocaleString()} for Loan ID ${loanId}. Principal remaining: LKR ${newPrincipalOutstanding.toLocaleString()}.`;
    await trx('audit_logs').insert({
      actor_id: agentId,
      action_type: 'RECORD_PAYMENT',
      description
    });

    // 6. Retrieve related user data for notifications
    const borrower = await trx('users').where({ id: loan.borrower_id }).first();
    const admin = await trx('users').where({ id: loan.lender_id }).first();

    return {
      transactionId: transaction.id || transaction,
      borrower,
      admin,
      amount: payAmount,
      paymentType,
      newPrincipalOutstanding,
      newInterestBalance,
      status: newStatus
    };
  });
}
