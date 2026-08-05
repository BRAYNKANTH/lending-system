import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { notifyLoanDefaulted } from '@/lib/services/notification.js';

// Mark a loan as defaulted (Admin only) — blocks further payment collection
export async function POST(request, { params }) {
  try {
    const authUser = requireAuth(request, ['admin']);
    const { id } = params;
    const { reason } = await request.json();

    if (!reason || !reason.trim()) {
      return NextResponse.json({ message: 'A reason is required to mark a loan as defaulted.' }, { status: 400 });
    }

    const loan = await db('loans').where({ id }).first();
    if (!loan) {
      return NextResponse.json({ message: 'Loan not found.' }, { status: 404 });
    }
    if (loan.status !== 'active') {
      return NextResponse.json({ message: `Only active loans can be marked defaulted (current status: '${loan.status}').` }, { status: 400 });
    }

    await db('loans').where({ id }).update({
      status: 'defaulted',
      default_reason: reason.trim(),
      defaulted_at: db.fn.now(),
      updated_at: db.fn.now()
    });

    await db('audit_logs').insert({
      actor_id: authUser.id,
      action_type: 'MARK_DEFAULTED',
      description: `Marked loan ID ${id} as defaulted. Reason: ${reason.trim()}. Outstanding principal: LKR ${parseFloat(loan.principal_outstanding).toLocaleString()}, interest due: LKR ${parseFloat(loan.interest_balance).toLocaleString()}.`
    });

    const borrower = await db('users').where({ id: loan.borrower_id }).first();
    const admin = await db('users').where({ id: loan.lender_id }).first();
    notifyLoanDefaulted({
      borrower,
      admin,
      reason: reason.trim(),
      principalOutstanding: loan.principal_outstanding
    }).catch((err) => console.error('Notification failed:', err));

    return NextResponse.json({ message: 'Loan marked as defaulted.' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Mark loan defaulted error:', error);
    return NextResponse.json({ message: 'Internal server error while marking loan defaulted.' }, { status: 500 });
  }
}
