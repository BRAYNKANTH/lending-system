import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { getAgentCashInHand } from '@/lib/services/remittance.js';

// Agent submits cash collected in the field to the office (Agent only)
export async function POST(request) {
  try {
    const authUser = requireAuth(request, ['agent']);
    const agentId = authUser.id;
    const { amount, notes } = await request.json();

    const remitAmount = parseFloat(amount);
    if (isNaN(remitAmount) || remitAmount <= 0) {
      return NextResponse.json({ message: 'Remittance amount must be a positive number.' }, { status: 400 });
    }

    const { cashInHand } = await getAgentCashInHand(agentId);
    if (remitAmount > cashInHand) {
      return NextResponse.json(
        { message: `Remittance amount (LKR ${remitAmount.toLocaleString()}) exceeds your current cash-in-hand (LKR ${cashInHand.toLocaleString()}).` },
        { status: 400 }
      );
    }

    const remittance = await db.transaction(async (trx) => {
      const [inserted] = await trx('remittances')
        .insert({ agent_id: agentId, amount: remitAmount, notes: notes || '', status: 'pending' })
        .returning('*');

      const remittanceId = inserted.id || inserted;

      await trx('ledger_entries').insert([
        { account: 'cash_office', type: 'debit', amount: remitAmount },
        { account: 'cash_agent', type: 'credit', amount: remitAmount }
      ]);

      await trx('audit_logs').insert({
        actor_id: agentId,
        action_type: 'SUBMIT_REMITTANCE',
        description: `Agent submitted a cash remittance of LKR ${remitAmount.toLocaleString()} to the office.`
      });

      return { id: remittanceId, agent_id: agentId, amount: remitAmount, notes: notes || '', status: 'pending' };
    });

    return NextResponse.json({ message: 'Remittance recorded and posted to ledger.', remittance }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Submit remittance error:', error);
    return NextResponse.json({ message: 'Internal server error while submitting remittance.' }, { status: 500 });
  }
}

// List remittances (Admin sees all, Agent sees their own)
export async function GET(request) {
  try {
    const { role, id } = requireAuth(request, ['admin', 'agent']);
    const status = request.nextUrl.searchParams.get('status');

    let query = db('remittances')
      .join('users as agents', 'remittances.agent_id', 'agents.id')
      .leftJoin('users as verifiers', 'remittances.verified_by', 'verifiers.id')
      .select('remittances.*', 'agents.name as agent_name', 'agents.phone as agent_phone', 'verifiers.name as verified_by_name');

    if (role === 'agent') query = query.where('remittances.agent_id', id);
    if (status) query = query.where('remittances.status', status);

    const remittances = await query.orderBy('remittances.created_at', 'desc');
    return NextResponse.json(remittances);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Fetch remittances error:', error);
    return NextResponse.json({ message: 'Failed to fetch remittances.' }, { status: 500 });
  }
}
