import db from '../config/db.js';

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

// Agent submits cash collected in the field to the office (Agent only)
export async function submitRemittance(req, res) {
  try {
    const agentId = req.user.id;
    const { amount, notes } = req.body;

    const remitAmount = parseFloat(amount);
    if (isNaN(remitAmount) || remitAmount <= 0) {
      return res.status(400).json({ message: 'Remittance amount must be a positive number.' });
    }

    const { cashInHand } = await getAgentCashInHand(agentId);
    if (remitAmount > cashInHand) {
      return res.status(400).json({
        message: `Remittance amount (LKR ${remitAmount.toLocaleString()}) exceeds your current cash-in-hand (LKR ${cashInHand.toLocaleString()}).`
      });
    }

    const remittance = await db.transaction(async (trx) => {
      const [inserted] = await trx('remittances')
        .insert({
          agent_id: agentId,
          amount: remitAmount,
          notes: notes || '',
          status: 'pending'
        })
        .returning('*');

      const remittanceId = inserted.id || inserted;

      // Cash physically leaves the agent's hand and moves to the office at
      // submission time — ledger posts now; 'verify' below is a bookkeeping
      // confirmation step, not a gate on the cash movement itself.
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

    res.status(201).json({ message: 'Remittance recorded and posted to ledger.', remittance });
  } catch (error) {
    console.error('Submit remittance error:', error);
    res.status(500).json({ message: 'Internal server error while submitting remittance.' });
  }
}

// List remittances (Admin sees all, Agent sees their own)
export async function getRemittances(req, res) {
  try {
    const { role, id } = req.user;
    const { status } = req.query;

    let query = db('remittances')
      .join('users as agents', 'remittances.agent_id', 'agents.id')
      .leftJoin('users as verifiers', 'remittances.verified_by', 'verifiers.id')
      .select(
        'remittances.*',
        'agents.name as agent_name',
        'agents.phone as agent_phone',
        'verifiers.name as verified_by_name'
      );

    if (role === 'agent') {
      query = query.where('remittances.agent_id', id);
    }
    if (status) {
      query = query.where('remittances.status', status);
    }

    const remittances = await query.orderBy('remittances.created_at', 'desc');
    res.json(remittances);
  } catch (error) {
    console.error('Fetch remittances error:', error);
    res.status(500).json({ message: 'Failed to fetch remittances.' });
  }
}

// Admin confirms a remittance was physically received/reconciled
export async function verifyRemittance(req, res) {
  try {
    const { id } = req.params;

    const remittance = await db('remittances').where({ id }).first();
    if (!remittance) {
      return res.status(404).json({ message: 'Remittance not found.' });
    }
    if (remittance.status === 'verified') {
      return res.status(400).json({ message: 'This remittance has already been verified.' });
    }

    await db('remittances').where({ id }).update({
      status: 'verified',
      verified_by: req.user.id,
      verified_at: db.fn.now()
    });

    await db('audit_logs').insert({
      actor_id: req.user.id,
      action_type: 'VERIFY_REMITTANCE',
      description: `Admin verified a cash remittance of LKR ${parseFloat(remittance.amount).toLocaleString()}.`
    });

    res.json({ message: 'Remittance verified.' });
  } catch (error) {
    console.error('Verify remittance error:', error);
    res.status(500).json({ message: 'Failed to verify remittance.' });
  }
}

// Cash-in-hand summary for the logged-in agent, or (Admin) for all agents
export async function getCashReconciliation(req, res) {
  try {
    const { role, id } = req.user;

    if (role === 'agent') {
      const summary = await getAgentCashInHand(id);
      return res.json({ agents: [{ agentId: id, agentName: req.user.name, ...summary }] });
    }

    const agents = await db('users').where({ role: 'agent' }).select('id', 'name', 'phone');
    const agents_summary = await Promise.all(
      agents.map(async (agent) => {
        const summary = await getAgentCashInHand(agent.id);
        return { agentId: agent.id, agentName: agent.name, agentPhone: agent.phone, ...summary };
      })
    );

    res.json({ agents: agents_summary });
  } catch (error) {
    console.error('Cash reconciliation error:', error);
    res.status(500).json({ message: 'Failed to build cash reconciliation summary.' });
  }
}
