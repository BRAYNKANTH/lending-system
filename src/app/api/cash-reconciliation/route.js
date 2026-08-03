import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { getAgentCashInHand } from '@/lib/services/remittance.js';

// Cash-in-hand summary for the logged-in agent, or (Admin) for all agents
export async function GET(request) {
  try {
    const { role, id, name } = requireAuth(request, ['admin', 'agent']);

    if (role === 'agent') {
      const summary = await getAgentCashInHand(id);
      return NextResponse.json({ agents: [{ agentId: id, agentName: name, ...summary }] });
    }

    const agents = await db('users').where({ role: 'agent' }).select('id', 'name', 'phone');
    const agentsSummary = await Promise.all(
      agents.map(async (agent) => {
        const summary = await getAgentCashInHand(agent.id);
        return { agentId: agent.id, agentName: agent.name, agentPhone: agent.phone, ...summary };
      })
    );

    return NextResponse.json({ agents: agentsSummary });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Cash reconciliation error:', error);
    return NextResponse.json({ message: 'Failed to build cash reconciliation summary.' }, { status: 500 });
  }
}
