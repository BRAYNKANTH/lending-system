import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';

// Admin disputes a remittance claim (e.g. the cash never actually arrived).
// Reverses the cash_in_transit entry back onto the agent's outstanding
// cash-in-hand liability — previously there was no way to dispute a
// remittance at all, only 'pending' -> 'verified'.
export async function PATCH(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin']);
    const { id } = params;
    const { reason } = await request.json();

    if (!reason || !reason.trim()) {
      return NextResponse.json({ message: 'A reason is required to reject a remittance.' }, { status: 400 });
    }

    await db.transaction(async (trx) => {
      const remittance = await trx('remittances').where({ id }).first().forUpdate();
      if (!remittance) {
        throw new Error('Remittance not found.');
      }
      if (remittance.status !== 'pending') {
        throw new Error(`Only pending remittances can be rejected (current status: '${remittance.status}').`);
      }

      const amount = parseFloat(remittance.amount);

      // Reverses the original submission entry: the claimed cash never
      // arrived, so it goes back onto the agent's outstanding liability.
      await trx('ledger_entries').insert([
        { account: 'cash_agent', type: 'debit', amount },
        { account: 'cash_in_transit', type: 'credit', amount }
      ]);

      await trx('remittances').where({ id }).update({
        status: 'rejected',
        verified_by: authUser.id,
        verified_at: trx.fn.now(),
        rejection_reason: reason.trim()
      });

      await trx('audit_logs').insert({
        actor_id: authUser.id,
        action_type: 'REJECT_REMITTANCE',
        description: `Admin rejected a cash remittance of LKR ${amount.toLocaleString()} from agent ID ${remittance.agent_id}. Reason: ${reason.trim()}.`
      });
    });

    return NextResponse.json({ message: 'Remittance rejected — reversed onto the agent\'s outstanding cash-in-hand.' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    if (error.message === 'Remittance not found.') return NextResponse.json({ message: error.message }, { status: 404 });
    if (error.message?.includes('can be rejected')) return NextResponse.json({ message: error.message }, { status: 400 });
    console.error('Reject remittance error:', error);
    return NextResponse.json({ message: 'Failed to reject remittance.' }, { status: 500 });
  }
}
