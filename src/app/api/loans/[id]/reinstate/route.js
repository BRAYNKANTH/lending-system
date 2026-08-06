import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { notifyLoanReinstated } from '@/lib/services/notification.js';

// Reverses a defaulted loan back to active, so payments can be collected on
// it again. Covers the real-world case where a defaulted borrower comes
// back wanting to pay something — previously there was no way to do this
// once a loan was marked defaulted; recordPaymentCollection hard-blocks any
// payment on a defaulted loan (Admin only).
export async function POST(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin']);
    const { id } = params;

    const loan = await db('loans').where({ id }).first();
    if (!loan) {
      return NextResponse.json({ message: 'Loan not found.' }, { status: 404 });
    }
    if (loan.status !== 'defaulted') {
      return NextResponse.json({ message: `Only defaulted loans can be reinstated (current status: '${loan.status}').` }, { status: 400 });
    }

    await db('loans').where({ id }).update({
      status: 'active',
      default_reason: null,
      defaulted_at: null,
      updated_at: db.fn.now()
    });

    await db('audit_logs').insert({
      actor_id: authUser.id,
      action_type: 'REINSTATE_LOAN',
      description: `Reinstated loan ID ${id} from 'defaulted' back to 'active'. Outstanding principal: LKR ${parseFloat(loan.principal_outstanding).toLocaleString()}, interest due: LKR ${parseFloat(loan.interest_balance).toLocaleString()}.`
    });

    const borrower = await db('users').where({ id: loan.borrower_id }).first();
    const admin = await db('users').where({ id: loan.lender_id }).first();
    notifyLoanReinstated({ borrower, admin }).catch((err) => console.error('Notification failed:', err));

    return NextResponse.json({ message: 'Loan reinstated to active — payments can be collected on it again.' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Reinstate loan error:', error);
    return NextResponse.json({ message: 'Internal server error while reinstating loan.' }, { status: 500 });
  }
}
