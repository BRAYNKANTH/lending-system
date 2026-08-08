import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { notifyPenaltyApplied } from '@/lib/services/notification.js';

// Apply a manual penalty / late fee to an active loan (Admin only)
export async function POST(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin']);
    const { id } = params;
    const { amount, reason } = await request.json();

    const penaltyAmount = parseFloat(amount);
    if (isNaN(penaltyAmount) || penaltyAmount <= 0) {
      return NextResponse.json({ message: 'Penalty amount must be a positive number.' }, { status: 400 });
    }

    const result = await db.transaction(async (trx) => {
      const loan = await trx('loans').where({ id }).first().forUpdate();
      if (!loan) {
        throw new Error('Loan not found.');
      }
      if (loan.status !== 'active') {
        throw new Error(`Penalties can only be applied to active loans (current status: '${loan.status}').`);
      }

      // A penalty is neither principal nor recurring interest — it's folded
      // into interest_balance (the "non-principal amount due" bucket) so it
      // shows up as something the borrower must pay off, without touching
      // principal_outstanding.
      const newInterestBalance = parseFloat(loan.interest_balance) + penaltyAmount;

      await trx('ledger_entries').insert([
        { loan_id: id, account: 'loan_receivable_interest', type: 'debit', amount: penaltyAmount },
        { loan_id: id, account: 'penalty_revenue', type: 'credit', amount: penaltyAmount }
      ]);

      await trx('loans').where({ id }).update({ interest_balance: newInterestBalance, updated_at: trx.fn.now() });

      await trx('audit_logs').insert({
        actor_id: authUser.id,
        action_type: 'APPLY_PENALTY',
        description: `Applied penalty of LKR ${penaltyAmount.toLocaleString()} to loan ID ${id}${reason ? ` (${reason.trim()})` : ''}. Interest/fees due: LKR ${newInterestBalance.toLocaleString()}.`
      });

      return { newInterestBalance, loan };
    });

    const borrower = await db('users').where({ id: result.loan.borrower_id }).first();
    const admin = await db('users').where({ id: result.loan.lender_id }).first();
    notifyPenaltyApplied({ borrower, admin, amount: penaltyAmount, reason: reason?.trim(), newInterestBalance: result.newInterestBalance })
      .catch((err) => console.error('Notification failed:', err));

    return NextResponse.json({ message: 'Penalty applied and posted to ledger.', newInterestBalance: result.newInterestBalance });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Apply penalty error:', error);
    if (error.message?.includes('not found') || error.message?.includes('active loans')) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Internal server error while applying penalty.' }, { status: 500 });
  }
}
