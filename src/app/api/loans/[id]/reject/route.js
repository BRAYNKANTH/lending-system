import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { notifyLoanApplicationRejected } from '@/lib/services/notification.js';

// Rejects an agent-submitted loan application (Admin only). No ledger
// movement — nothing was ever posted for a pending application, so there's
// nothing to reverse.
export async function POST(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin']);
    const { id } = params;
    const { reason } = await request.json();

    if (!reason || !reason.trim()) {
      return NextResponse.json({ message: 'A reason is required to reject a loan application.' }, { status: 400 });
    }

    const loan = await db.transaction(async (trx) => {
      const loanRow = await trx('loans').where({ id }).first().forUpdate();
      if (!loanRow) {
        throw new Error('Loan not found.');
      }
      if (loanRow.status !== 'pending') {
        throw new Error(`Only pending applications can be rejected (current status: '${loanRow.status}').`);
      }

      await trx('loans').where({ id }).update({
        status: 'rejected',
        loan_rejection_reason: reason.trim(),
        rejected_at: trx.fn.now(),
        updated_at: trx.fn.now()
      });

      await trx('audit_logs').insert({
        actor_id: authUser.id,
        action_type: 'REJECT_LOAN_APPLICATION',
        description: `Rejected loan application ID ${id} (LKR ${parseFloat(loanRow.principal_amount).toLocaleString()}) submitted by lender ID ${loanRow.lender_id}. Reason: ${reason.trim()}.`
      });

      return loanRow;
    });

    const submittedBy = await db('users').where({ id: loan.lender_id }).first();
    const borrower = await db('users').where({ id: loan.borrower_id }).first();
    notifyLoanApplicationRejected({
      submittedBy: submittedBy?.role === 'agent' ? submittedBy : null,
      borrowerName: borrower?.name || 'the borrower',
      principal: loan.principal_amount,
      reason: reason.trim()
    }).catch((err) => console.error('Notification failed:', err));

    return NextResponse.json({ message: 'Loan application rejected.' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Reject loan error:', error);
    if (error.message?.includes('not found') || error.message?.includes('can be rejected')) {
      return NextResponse.json({ message: error.message }, { status: error.message.includes('not found') ? 404 : 400 });
    }
    return NextResponse.json({ message: 'Internal server error while rejecting loan application.' }, { status: 500 });
  }
}
