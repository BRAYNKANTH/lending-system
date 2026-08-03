import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';

export async function GET(request) {
  try {
    requireAuth(request, ['admin']);
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const moneyLentResult = await db('loans').sum('principal_amount as total');
    const totalMoneyLent = parseFloat(moneyLentResult[0].total) || 0;

    const activeLoansResult = await db('loans').where({ status: 'active' }).count('id as count');
    const totalActiveLoans = parseInt(activeLoansResult[0].count) || 0;

    const repaymentsResult = await db('transactions').sum('amount as total');
    const totalRepayments = parseFloat(repaymentsResult[0].total) || 0;

    const overdueResult = await db('loans')
      .where('status', 'active')
      .andWhere('current_balance', '>', 0)
      .andWhere('next_accrual_date', '<', now)
      .count('id as count');
    const totalOverdue = parseInt(overdueResult[0].count) || 0;

    const agentPerformance = await db('transactions')
      .join('users as agents', 'transactions.agent_id', 'agents.id')
      .select('agents.name as agent_name')
      .count('transactions.id as collections_count')
      .sum('transactions.amount as total_collected')
      .groupBy('agents.name');

    const collectionsTodayResult = await db('transactions').where('payment_date', '>=', todayStart).sum('amount as total');
    const collectionsToday = parseFloat(collectionsTodayResult[0].total) || 0;

    const interestTodayResult = await db('interest_accruals').where('created_at', '>=', todayStart).sum('amount_accrued as total');
    const interestToday = parseFloat(interestTodayResult[0].total) || 0;

    const recentAudit = await db('audit_logs')
      .leftJoin('users', 'audit_logs.actor_id', 'users.id')
      .select('audit_logs.*', 'users.name as actor_name')
      .orderBy('audit_logs.created_at', 'desc')
      .limit(10);

    const overdueLoans = await db('loans')
      .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
      .leftJoin('users as agents', 'loans.assigned_agent_id', 'agents.id')
      .where('loans.status', 'active')
      .andWhere('loans.current_balance', '>', 0)
      .andWhere('loans.next_accrual_date', '<', now)
      .select('loans.*', 'borrowers.name as borrower_name', 'agents.name as agent_name');

    const interestByType = await db('interest_accruals')
      .join('loans', 'interest_accruals.loan_id', 'loans.id')
      .select('loans.interest_type')
      .sum('interest_accruals.amount_accrued as total')
      .groupBy('loans.interest_type');

    const recentAccruals = await db('interest_accruals')
      .join('loans', 'interest_accruals.loan_id', 'loans.id')
      .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
      .select('interest_accruals.*', 'borrowers.name as borrower_name', 'loans.principal_amount', 'loans.interest_rate', 'loans.interest_type')
      .orderBy('interest_accruals.created_at', 'desc')
      .limit(10);

    return NextResponse.json({
      summary: {
        totalMoneyLent,
        totalActiveLoans,
        totalRepayments,
        totalOverdue,
        totalOutstanding: (totalMoneyLent - totalRepayments > 0) ? (totalMoneyLent - totalRepayments) : 0
      },
      dailyReport: { collectionsToday, interestToday, date: todayStart.toDateString() },
      agentPerformance,
      overdueLoans,
      recentAudit,
      interestByType,
      recentAccruals
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Admin dashboard error:', error);
    return NextResponse.json({ message: 'Failed to build admin dashboard statistics.' }, { status: 500 });
  }
}
