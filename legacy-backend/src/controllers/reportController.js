import db from '../config/db.js';

const ACCOUNT_LABELS = {
  cash_agent: 'Cash in Agent Hands',
  cash_office: 'Cash at Office',
  loan_receivable: 'Loans Receivable',
  interest_revenue: 'Interest Revenue',
  penalty_revenue: 'Penalty Revenue'
};

// Consolidated ledger / trial balance report (Admin only)
export async function getLedgerReport(req, res) {
  try {
    const { from, to } = req.query;

    let query = db('ledger_entries').select('account', 'type').sum('amount as total').groupBy('account', 'type');
    if (from) {
      query = query.andWhere('created_at', '>=', new Date(from));
    }
    if (to) {
      query = query.andWhere('created_at', '<=', new Date(to));
    }

    const rows = await query;

    const byAccount = {};
    for (const row of rows) {
      if (!byAccount[row.account]) {
        byAccount[row.account] = { account: row.account, label: ACCOUNT_LABELS[row.account] || row.account, debit: 0, credit: 0 };
      }
      byAccount[row.account][row.type] = parseFloat(row.total) || 0;
    }

    const accounts = Object.values(byAccount).map((a) => ({
      ...a,
      net: a.debit - a.credit
    }));

    const totals = accounts.reduce(
      (acc, a) => ({ debit: acc.debit + a.debit, credit: acc.credit + a.credit }),
      { debit: 0, credit: 0 }
    );

    res.json({
      generatedAt: new Date().toISOString(),
      range: { from: from || null, to: to || null },
      accounts,
      totals: { ...totals, balanced: Math.abs(totals.debit - totals.credit) < 0.01 }
    });
  } catch (error) {
    console.error('Ledger report error:', error);
    res.status(500).json({ message: 'Failed to build ledger report.' });
  }
}
