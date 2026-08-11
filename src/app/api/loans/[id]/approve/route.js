import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { addInterval } from '@/lib/loanSchedule.js';
import { notifyLoanApplicationApproved } from '@/lib/services/notification.js';

// Approves an agent-submitted loan application (Admin only) — this is the
// moment the loan actually disburses: ledger entries post here, not at
// submission time, since no cash moved until an admin signed off.
export async function POST(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin']);
    const { id } = params;

    const result = await db.transaction(async (trx) => {
      const loan = await trx('loans').where({ id }).first().forUpdate();
      if (!loan) {
        throw new Error('Loan not found.');
      }
      if (loan.status !== 'pending') {
        throw new Error(`Only pending applications can be approved (current status: '${loan.status}').`);
      }

      const principal = parseFloat(loan.principal_amount);

      // Interest starts accruing from the moment of approval, not from
      // whenever the agent originally submitted the application — the
      // borrower shouldn't owe interest for time the loan spent sitting in
      // the review queue.
      const now = new Date();
      const nextAccrualDate = addInterval(now, loan.interest_type);
      let maturityDate = loan.maturity_date;
      if (loan.collection_mode === 'fixed_term' && loan.duration_periods) {
        // Flat installment loans start collecting on approval day itself
        // (day 0 = the 1st of duration_periods collection days), same as
        // the day-0-counts rule applied at creation time.
        maturityDate = loan.is_flat_installment
          ? addInterval(now, loan.interest_type, loan.duration_periods - 1)
          : addInterval(now, loan.interest_type, loan.duration_periods);
      }

      await trx('loans').where({ id }).update({
        status: 'active',
        approved_by: authUser.id,
        approved_at: trx.fn.now(),
        next_accrual_date: nextAccrualDate,
        maturity_date: maturityDate,
        updated_at: trx.fn.now()
      });

      await trx('ledger_entries').insert([
        { loan_id: id, account: 'loan_receivable_principal', type: 'debit', amount: principal },
        { loan_id: id, account: 'cash_office', type: 'credit', amount: principal }
      ]);

      await trx('audit_logs').insert({
        actor_id: authUser.id,
        action_type: 'APPROVE_LOAN',
        description: `Approved loan application ID ${id} (LKR ${principal.toLocaleString()}) submitted by lender ID ${loan.lender_id}. Loan is now active and disbursed.`
      });

      return loan;
    });

    const borrower = await db('users').where({ id: result.borrower_id }).first();
    const submittedBy = await db('users').where({ id: result.lender_id }).first();
    notifyLoanApplicationApproved({
      borrower,
      principal: result.principal_amount,
      interestType: result.interest_type,
      rate: result.interest_rate,
      submittedBy: submittedBy?.role === 'agent' ? submittedBy : null,
      isFlatInstallment: result.is_flat_installment,
      dailyInstallmentAmount: result.daily_installment_amount,
      durationPeriods: result.duration_periods
    }).catch((err) => console.error('Notification failed:', err));

    return NextResponse.json({ message: 'Loan application approved and disbursed.' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Approve loan error:', error);
    if (error.message?.includes('not found') || error.message?.includes('can be approved')) {
      return NextResponse.json({ message: error.message }, { status: error.message.includes('not found') ? 404 : 400 });
    }
    return NextResponse.json({ message: 'Internal server error while approving loan.' }, { status: 500 });
  }
}
