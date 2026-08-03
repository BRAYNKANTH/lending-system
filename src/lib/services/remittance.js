import db from '../db.js';

/**
 * Computes an agent's cash-in-hand: total collected via payments minus
 * total already remitted to the office. This is what reconciles the
 * 'cash_agent' ledger account for a single agent.
 */
export async function getAgentCashInHand(agentId) {
  const collectedResult = await db('transactions').where({ agent_id: agentId }).sum('amount as total');
  const remittedResult = await db('remittances').where({ agent_id: agentId }).sum('amount as total');

  const totalCollected = parseFloat(collectedResult[0].total) || 0;
  const totalRemitted = parseFloat(remittedResult[0].total) || 0;

  return {
    totalCollected,
    totalRemitted,
    cashInHand: totalCollected - totalRemitted
  };
}
