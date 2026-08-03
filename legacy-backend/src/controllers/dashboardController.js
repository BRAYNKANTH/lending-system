import db from '../config/db.js';
import { getAgentCashInHand } from './remittanceController.js';

// Admin Dashboard Analytics
export async function getAdminDashboard(req, res) {
  try {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 1. Total money lent (Sum of principal of all loans)
    const moneyLentResult = await db('loans').sum('principal_amount as total');
    const totalMoneyLent = parseFloat(moneyLentResult[0].total) || 0;

    // 2. Total active loans count
    const activeLoansResult = await db('loans').where({ status: 'active' }).count('id as count');
    const totalActiveLoans = parseInt(activeLoansResult[0].count) || 0;

    // 3. Total repayments collected (Sum of all payments)
    const repaymentsResult = await db('transactions').sum('amount as total');
    const totalRepayments = parseFloat(repaymentsResult[0].total) || 0;

    // 4. Overdue borrowers count (Loans where next_accrual_date is past due and current_balance > 0)
    const overdueResult = await db('loans')
      .where('status', 'active')
      .andWhere('current_balance', '>', 0)
      .andWhere('next_accrual_date', '<', now)
      .count('id as count');
    const totalOverdue = parseInt(overdueResult[0].count) || 0;

    // 5. Agent performance tracking (Group collections by agent name)
    const agentPerformance = await db('transactions')
      .join('users as agents', 'transactions.agent_id', 'agents.id')
      .select('agents.name as agent_name')
      .count('transactions.id as collections_count')
      .sum('transactions.amount as total_collected')
      .groupBy('agents.name');

    // 6. Daily income report (collected today & interest accrued today)
    const collectionsTodayResult = await db('transactions')
      .where('payment_date', '>=', todayStart)
      .sum('amount as total');
    const collectionsToday = parseFloat(collectionsTodayResult[0].total) || 0;

    const interestTodayResult = await db('interest_accruals')
      .where('created_at', '>=', todayStart)
      .sum('amount_accrued as total');
    const interestToday = parseFloat(interestTodayResult[0].total) || 0;

    // 7. List of recent audit activities
    const recentAudit = await db('audit_logs')
      .leftJoin('users', 'audit_logs.actor_id', 'users.id')
      .select('audit_logs.*', 'users.name as actor_name')
      .orderBy('audit_logs.created_at', 'desc')
      .limit(10);

    // 8. List of loans flagged as overdue
    const overdueLoans = await db('loans')
      .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
      .leftJoin('users as agents', 'loans.assigned_agent_id', 'agents.id')
      .where('loans.status', 'active')
      .andWhere('loans.current_balance', '>', 0)
      .andWhere('loans.next_accrual_date', '<', now)
      .select(
        'loans.*',
        'borrowers.name as borrower_name',
        'agents.name as agent_name'
      );

    // 9. Interest Accruals Breakdown by Frequency
    const interestByType = await db('interest_accruals')
      .join('loans', 'interest_accruals.loan_id', 'loans.id')
      .select('loans.interest_type')
      .sum('interest_accruals.amount_accrued as total')
      .groupBy('loans.interest_type');

    // 10. List of recent interest accrual logs with calculations
    const recentAccruals = await db('interest_accruals')
      .join('loans', 'interest_accruals.loan_id', 'loans.id')
      .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
      .select(
        'interest_accruals.*',
        'borrowers.name as borrower_name',
        'loans.principal_amount',
        'loans.interest_rate',
        'loans.interest_type'
      )
      .orderBy('interest_accruals.created_at', 'desc')
      .limit(10);

    res.json({
      summary: {
        totalMoneyLent,
        totalActiveLoans,
        totalRepayments,
        totalOverdue,
        totalOutstanding: (totalMoneyLent - totalRepayments > 0) ? (totalMoneyLent - totalRepayments) : 0
      },
      dailyReport: {
        collectionsToday,
        interestToday,
        date: todayStart.toDateString()
      },
      agentPerformance,
      overdueLoans,
      recentAudit,
      interestByType,
      recentAccruals
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'Failed to build admin dashboard statistics.' });
  }
}

// Agent Dashboard Analytics
export async function getAgentDashboard(req, res) {
  try {
    const agentId = req.user.id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 1. Today's collection amount
    const collectionsTodayResult = await db('transactions')
      .where({ agent_id: agentId })
      .andWhere('payment_date', '>=', todayStart)
      .sum('amount as total');
    const collectionsToday = parseFloat(collectionsTodayResult[0].total) || 0;

    // 2. Active assigned loans
    const assignedLoans = await db('loans')
      .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
      .where({ assigned_agent_id: agentId, 'loans.status': 'active' })
      .select('loans.*', 'borrowers.name as borrower_name', 'borrowers.phone as borrower_phone')
      .orderBy('loans.current_balance', 'desc');

    // 3. Collection history by this agent
    const collectionHistory = await db('transactions')
      .join('users as borrowers', 'transactions.borrower_id', 'borrowers.id')
      .where({ agent_id: agentId })
      .select('transactions.*', 'borrowers.name as borrower_name')
      .orderBy('transactions.payment_date', 'desc')
      .limit(10);

    const cashInHand = await getAgentCashInHand(agentId);

    res.json({
      summary: {
        collectionsToday,
        assignedCount: assignedLoans.length,
        ...cashInHand
      },
      assignedLoans,
      collectionHistory
    });

  } catch (error) {
    console.error('Agent dashboard error:', error);
    res.status(500).json({ message: 'Failed to build agent dashboard statistics.' });
  }
}

// Borrower Dashboard Analytics
export async function getBorrowerDashboard(req, res) {
  try {
    const borrowerId = req.user.id;

    // 1. Get borrower active loans
    const loans = await db('loans')
      .leftJoin('users as agents', 'loans.assigned_agent_id', 'agents.id')
      .where({ borrower_id: borrowerId })
      .select('loans.*', 'agents.name as agent_name', 'agents.phone as agent_phone')
      .orderBy('loans.created_at', 'desc');

    // 2. Payments history
    const payments = await db('transactions')
      .join('users as agents', 'transactions.agent_id', 'agents.id')
      .where({ borrower_id: borrowerId })
      .select('transactions.*', 'agents.name as agent_name')
      .orderBy('transactions.payment_date', 'desc');

    // 3. Summaries
    const activeLoans = loans.filter(l => l.status === 'active');
    const totalOutstanding = activeLoans.reduce((sum, l) => sum + parseFloat(l.current_balance), 0);
    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    // 4. Borrower interest totals by type
    const interestByType = await db('interest_accruals')
      .join('loans', 'interest_accruals.loan_id', 'loans.id')
      .where('loans.borrower_id', borrowerId)
      .select('loans.interest_type')
      .sum('interest_accruals.amount_accrued as total')
      .groupBy('loans.interest_type');

    // 5. Borrower recent interest charge logs
    const recentAccruals = await db('interest_accruals')
      .join('loans', 'interest_accruals.loan_id', 'loans.id')
      .where('loans.borrower_id', borrowerId)
      .select(
        'interest_accruals.*',
        'loans.principal_amount',
        'loans.interest_rate',
        'loans.interest_type'
      )
      .orderBy('interest_accruals.created_at', 'desc')
      .limit(10);

    res.json({
      summary: {
        totalOutstanding,
        totalPaid,
        activeLoansCount: activeLoans.length
      },
      loans,
      payments,
      interestByType,
      recentAccruals
    });

  } catch (error) {
    console.error('Borrower dashboard error:', error);
    res.status(500).json({ message: 'Failed to build borrower dashboard statistics.' });
  }
}
