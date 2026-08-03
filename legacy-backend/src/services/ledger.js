import db from '../config/db.js';

/**
 * Applies a payment against a loan's installment schedule, oldest unpaid
 * installment first (mirrors how the physical passbook is settled row by
 * row). Splits across multiple installments and supports partial payments.
 * No-op for loans that don't have a schedule.
 */
async function allocatePaymentToInstallments(trx, loanId, amount) {
  const installments = await trx('installments')
    .where({ loan_id: loanId })
    .orderBy('installment_number', 'asc')
    .forUpdate();

  let remaining = amount;
  for (const inst of installments) {
    if (remaining <= 0) break;
    const due = parseFloat(inst.expected_amount) - parseFloat(inst.paid_amount);
    if (due <= 0) continue;

    const applied = Math.min(due, remaining);
    const newPaidAmount = parseFloat(inst.paid_amount) + applied;
    remaining -= applied;

    await trx('installments')
      .where({ id: inst.id })
      .update({
        paid_amount: newPaidAmount,
        paid_at: newPaidAmount >= parseFloat(inst.expected_amount) ? trx.fn.now() : inst.paid_at
      });
  }
}

/**
 * Records a cash payment collection from a borrower.
 * Executed inside a single transaction with row-level locks.
 */
export async function recordPaymentCollection({ loanId, agentId, amount, notes, proofImageUrl, idempotencyKey, paymentMethod }) {
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
    const currentBalance = parseFloat(loan.current_balance);

    if (payAmount > currentBalance) {
      throw new Error(`Payment amount (LKR ${payAmount.toLocaleString()}) exceeds outstanding balance (LKR ${currentBalance.toLocaleString()}).`);
    }

    // 2. Insert transaction entry
    const [transaction] = await trx('transactions')
      .insert({
        loan_id: loanId,
        agent_id: agentId,
        borrower_id: loan.borrower_id,
        amount: payAmount,
        notes: notes || '',
        proof_image_url: proofImageUrl || null,
        payment_method: paymentMethod || 'cash',
        idempotency_key: idempotencyKey
      })
      .returning('*');

    // 3. Post double-entry ledger entries:
    // A: Debit cash_agent (Asset increases)
    // B: Credit loan_receivable (Asset decreases)
    await trx('ledger_entries').insert([
      {
        loan_id: loanId,
        transaction_id: transaction.id || transaction, // handling knex returning variations
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

    // 4. Update current balance of loan
    const newBalance = currentBalance - payAmount;
    const newStatus = newBalance <= 0 ? 'fully_paid' : 'active';

    await trx('loans')
      .where({ id: loanId })
      .update({
        current_balance: newBalance,
        status: newStatus,
        updated_at: db.fn.now()
      });

    // 4b. Allocate this payment against the repayment schedule / passbook
    await allocatePaymentToInstallments(trx, loanId, payAmount);

    // 5. Create audit log
    await trx('audit_logs').insert({
      actor_id: agentId,
      action_type: 'RECORD_PAYMENT',
      description: `Collected payment of LKR ${payAmount.toLocaleString()} for Loan ID ${loanId}. Remaining: LKR ${newBalance.toLocaleString()}.`
    });

    // 6. Retrieve related user data for notifications
    const borrower = await trx('users').where({ id: loan.borrower_id }).first();
    const admin = await trx('users').where({ id: loan.lender_id }).first();

    return {
      transactionId: transaction.id || transaction,
      borrower,
      admin,
      amount: payAmount,
      newBalance,
      status: newStatus
    };
  });
}
