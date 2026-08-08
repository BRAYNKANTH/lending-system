import db from '../db.js';

/**
 * Computes an agent's cash-in-hand: total collected via payments minus
 * total already remitted to the office. This is what reconciles the
 * 'cash_agent' ledger account for a single agent.
 */
export async function getAgentCashInHand(agentId) {
  const collectedResult = await db('transactions').where({ agent_id: agentId, payment_method: 'cash' }).sum('amount as total');
  // Rejected remittances don't reduce cash-in-hand — the cash never
  // actually left the agent (or came back), so only pending/verified claims
  // count against their outstanding liability.
  const remittedResult = await db('remittances')
    .where({ agent_id: agentId })
    .whereIn('status', ['pending', 'verified'])
    .sum('amount as total');

  const totalCollected = parseFloat(collectedResult[0].total) || 0;
  const totalRemitted = parseFloat(remittedResult[0].total) || 0;

  return {
    totalCollected,
    totalRemitted,
    cashInHand: totalCollected - totalRemitted
  };
}
