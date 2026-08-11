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
export async function recordPaymentCollection({ loanId, agentId, amount, paymentType, notes, proofImageUrl, idempotencyKey, paymentMethod, paymentDate }) {
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

    if (loan.status === 'written_off') {
      throw new Error('This loan has been written off as bad debt and no longer accepts payments.');
    }

    if (loan.status === 'defaulted') {
      throw new Error("This loan is defaulted. Reinstate it first (Admin > Reinstate Loan) before recording a payment.");
    }

    if (loan.status === 'pending') {
      throw new Error('This loan application is still awaiting admin approval and has not been disbursed yet.');
    }

    if (loan.status === 'rejected') {
      throw new Error('This loan application was rejected and was never disbursed.');
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
        idempotency_key: idempotencyKey,
        ...(paymentDate ? { payment_date: paymentDate } : {})
      })
      .returning('*');

    // 3. Post double-entry ledger entries. The receivable is split into a
    // principal account and an interest account so the trial balance can
    // report principal-at-risk separately from interest-at-risk — which of
    // the two this credit clears depends on paymentType.
    // A: Debit cash_agent or cash_office depending on payment method
    const debitAccount = (paymentMethod && paymentMethod !== 'cash') ? 'cash_office' : 'cash_agent';
    const receivableAccount = paymentType === 'interest' ? 'loan_receivable_interest' : 'loan_receivable_principal';
    await trx('ledger_entries').insert([
      {
        loan_id: loanId,
        transaction_id: transaction.id || transaction,
        account: debitAccount,
        type: 'debit',
        amount: payAmount
      },
      {
        loan_id: loanId,
        transaction_id: transaction.id || transaction,
        account: receivableAccount,
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
    const agent = await trx('users').where({ id: agentId }).first();

    return {
      transactionId: transaction.id || transaction,
      borrower,
      admin,
      agent,
      amount: payAmount,
      paymentType,
      interestType: loan.interest_type,
      newPrincipalOutstanding,
      newInterestBalance,
      status: newStatus
    };
  });
}

/**
 * Records a flat daily installment collection for a Flat Installment loan
 * (Daily + Fixed Term, 31/62/93-day terms — see loans/route.js) — the
 * client's actual field practice, where a single daily payment covers BOTH
 * principal and interest at once, unlike every other loan type in this
 * system where a payment is either purely interest or purely principal.
 *
 * The split uses the loan's fixed per-day ratio (principal_per_day ÷
 * daily_installment_amount, computed once at creation) so every collection
 * — full or partial — reduces both principal_outstanding and
 * interest_balance in the same proportion, and both reach exactly zero on
 * schedule if every day's flat amount is collected in full.
 */
export async function recordFlatInstallmentCollection({ loanId, agentId, amount, notes, proofImageUrl, idempotencyKey, paymentMethod, paymentDate }) {
  return await db.transaction(async (trx) => {
    const loan = await trx('loans')
      .where({ id: loanId })
      .first()
      .forUpdate();

    if (!loan) {
      throw new Error('Loan not found.');
    }
    if (!loan.is_flat_installment) {
      throw new Error('This loan is not a flat installment loan — use the regular interest/principal payment instead.');
    }

    if (loan.status === 'fully_paid') {
      throw new Error('This loan has already been fully paid.');
    }
    if (loan.status === 'written_off') {
      throw new Error('This loan has been written off as bad debt and no longer accepts payments.');
    }
    if (loan.status === 'defaulted') {
      throw new Error("This loan is defaulted. Reinstate it first (Admin > Reinstate Loan) before recording a payment.");
    }
    if (loan.status === 'pending') {
      throw new Error('This loan application is still awaiting admin approval and has not been disbursed yet.');
    }
    if (loan.status === 'rejected') {
      throw new Error('This loan application was rejected and was never disbursed.');
    }

    const payAmount = parseFloat(amount);
    const principalOutstanding = parseFloat(loan.principal_outstanding);
    const interestBalance = parseFloat(loan.interest_balance);
    const totalOutstanding = principalOutstanding + interestBalance;

    if (payAmount > totalOutstanding) {
      throw new Error(`Payment (LKR ${payAmount.toLocaleString()}) exceeds the total outstanding balance (LKR ${totalOutstanding.toLocaleString()}).`);
    }

    // Split proportionally using the fixed per-day ratio set at creation.
    const principalPerDay = parseFloat(loan.principal_per_day) || 0;
    const dailyInstallment = parseFloat(loan.daily_installment_amount) || (principalPerDay + (parseFloat(loan.interest_per_day) || 0));
    const principalRatio = dailyInstallment > 0 ? principalPerDay / dailyInstallment : 0;

    let principalPortion = payAmount * principalRatio;
    let interestPortion = payAmount - principalPortion;

    // Cap each side at what's actually still owed on it — the last
    // collection of the term (or an odd partial amount) can otherwise push
    // one side slightly negative from rounding or from one side already
    // being paid down faster than the other.
    if (principalPortion > principalOutstanding) {
      interestPortion += principalPortion - principalOutstanding;
      principalPortion = principalOutstanding;
    }
    if (interestPortion > interestBalance) {
      principalPortion += interestPortion - interestBalance;
      interestPortion = interestBalance;
    }
    principalPortion = Math.min(principalPortion, principalOutstanding);
    interestPortion = Math.min(interestPortion, interestBalance);

    const [transaction] = await trx('transactions')
      .insert({
        loan_id: loanId,
        agent_id: agentId,
        borrower_id: loan.borrower_id,
        amount: payAmount,
        payment_type: 'flat_installment',
        principal_component: principalPortion,
        interest_component: interestPortion,
        notes: notes || '',
        proof_image_url: proofImageUrl || null,
        payment_method: paymentMethod || 'cash',
        idempotency_key: idempotencyKey,
        ...(paymentDate ? { payment_date: paymentDate } : {})
      })
      .returning('*');

    const debitAccount = (paymentMethod && paymentMethod !== 'cash') ? 'cash_office' : 'cash_agent';
    const transactionId = transaction.id || transaction;
    const ledgerRows = [
      { loan_id: loanId, transaction_id: transactionId, account: debitAccount, type: 'debit', amount: payAmount }
    ];
    if (principalPortion > 0) {
      ledgerRows.push({ loan_id: loanId, transaction_id: transactionId, account: 'loan_receivable_principal', type: 'credit', amount: principalPortion });
    }
    if (interestPortion > 0) {
      ledgerRows.push({ loan_id: loanId, transaction_id: transactionId, account: 'loan_receivable_interest', type: 'credit', amount: interestPortion });
    }
    await trx('ledger_entries').insert(ledgerRows);

    // Same closing rule as every other loan type: settled once principal
    // hits zero, regardless of the interest schedule. Under normal full
    // daily-installment collection both sides reach zero together anyway.
    const newPrincipalOutstanding = principalOutstanding - principalPortion;
    const newInterestBalance = interestBalance - interestPortion;
    const newStatus = newPrincipalOutstanding <= 0 ? 'fully_paid' : loan.status;
    const finalPrincipal = newStatus === 'fully_paid' ? 0 : newPrincipalOutstanding;
    const finalInterest = newStatus === 'fully_paid' ? 0 : newInterestBalance;

    await trx('loans')
      .where({ id: loanId })
      .update({
        principal_outstanding: finalPrincipal,
        interest_balance: finalInterest,
        status: newStatus,
        updated_at: db.fn.now()
      });

    await trx('audit_logs').insert({
      actor_id: agentId,
      action_type: 'RECORD_PAYMENT',
      description: `Collected flat daily installment of LKR ${payAmount.toLocaleString()} for Loan ID ${loanId} (Principal: LKR ${principalPortion.toLocaleString()}, Interest: LKR ${interestPortion.toLocaleString()}). Remaining: Principal LKR ${finalPrincipal.toLocaleString()}, Interest LKR ${finalInterest.toLocaleString()}.`
    });

    const borrower = await trx('users').where({ id: loan.borrower_id }).first();
    const admin = await trx('users').where({ id: loan.lender_id }).first();
    const agent = await trx('users').where({ id: agentId }).first();

    return {
      transactionId,
      borrower,
      admin,
      agent,
      amount: payAmount,
      paymentType: 'flat_installment',
      principalComponent: principalPortion,
      interestComponent: interestPortion,
      interestType: loan.interest_type,
      newPrincipalOutstanding: finalPrincipal,
      newInterestBalance: finalInterest,
      status: newStatus
    };
  });
}
