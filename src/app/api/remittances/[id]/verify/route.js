import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';

// Admin confirms a remittance was physically received/reconciled
export async function PATCH(request, { params }) {
  try {
    const authUser = requireAuth(request, ['admin']);
    const { id } = params;

    const remittance = await db('remittances').where({ id }).first();
    if (!remittance) {
      return NextResponse.json({ message: 'Remittance not found.' }, { status: 404 });
    }
    if (remittance.status === 'verified') {
      return NextResponse.json({ message: 'This remittance has already been verified.' }, { status: 400 });
    }

    await db('remittances').where({ id }).update({
      status: 'verified',
      verified_by: authUser.id,
      verified_at: db.fn.now()
    });

    await db('audit_logs').insert({
      actor_id: authUser.id,
      action_type: 'VERIFY_REMITTANCE',
      description: `Admin verified a cash remittance of LKR ${parseFloat(remittance.amount).toLocaleString()}.`
    });

    return NextResponse.json({ message: 'Remittance verified.' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Verify remittance error:', error);
    return NextResponse.json({ message: 'Failed to verify remittance.' }, { status: 500 });
  }
}
