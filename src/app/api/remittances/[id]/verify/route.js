import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { logError } from '@/lib/logger.js';

// Admin confirms a remittance was physically received/reconciled
export async function PATCH(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin']);
    const { id } = params;

    await db.transaction(async (trx) => {
      const remittance = await trx('remittances').where({ id }).first().forUpdate();
      if (!remittance) {
        throw new Error('Remittance not found.');
      }
      if (remittance.status !== 'pending') {
        throw new Error(`Only pending remittances can be verified (current status: '${remittance.status}').`);
      }

      const amount = parseFloat(remittance.amount);

      // Confirms the cash actually arrived: moves it out of the
      // cash_in_transit holding account and into confirmed office cash.
      await trx('ledger_entries').insert([
        { account: 'cash_office', type: 'debit', amount },
        { account: 'cash_in_transit', type: 'credit', amount }
      ]);

      await trx('remittances').where({ id }).update({
        status: 'verified',
        verified_by: authUser.id,
        verified_at: trx.fn.now()
      });

      await trx('audit_logs').insert({
        actor_id: authUser.id,
        action_type: 'VERIFY_REMITTANCE',
        description: `Admin verified a cash remittance of LKR ${amount.toLocaleString()}.`
      });
    });

    return NextResponse.json({ message: 'Remittance verified.' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    if (error.message === 'Remittance not found.') return NextResponse.json({ message: error.message }, { status: 404 });
    if (error.message?.includes('can be verified')) return NextResponse.json({ message: error.message }, { status: 400 });
    logError('Verify remittance error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Failed to verify remittance.' }, { status: 500 });
  }
}
