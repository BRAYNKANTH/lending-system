import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { stripLoanMediaList } from '@/lib/stripMedia.js';

export async function GET(request) {
  try {
    await requireAuth(request, ['admin']);
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // None of these queries depend on each other's results — they were
    // previously 10 sequential awaits, each paying a full network
    // round-trip to the database before the next one could even start.
    // Running them concurrently turns ~10 round-trips into effectively 1.
    const [
      moneyLentResult,
      activeLoansResult,
      repaymentsResult,
      overdueResult,
      outstandingResult,
      agentPerformance,
      collectionsTodayResult,
      interestTodayResult,
      recentAudit,
      overdueLoansRaw,
      interestByType,
      recentAccruals,
      remittancesResult,
      activeLoansList,
      pendingApprovalsRaw
    ] = await Promise.all([
      db('loans').sum('principal_amount as total'),
      db('loans').where({ status: 'active' }).count('id as count'),
      db('transactions').sum('amount as total'),
      db('loans').where('status', 'active').andWhere('next_accrual_date', '<', now).count('id as count'),
      db('loans').where({ status: 'active' })
        .select(db.raw('COALESCE(SUM(principal_outstanding), 0) as principal'), db.raw('COALESCE(SUM(interest_balance), 0) as interest')),
      db('transactions')
        .join('users as agents', 'transactions.agent_id', 'agents.id')
        .select('agents.name as agent_name')
        .count('transactions.id as collections_count')
        .sum('transactions.amount as total_collected')
        .groupBy('agents.name'),
      db('transactions').where('payment_date', '>=', todayStart).sum('amount as total'),
      db('interest_accruals').where('created_at', '>=', todayStart).sum('amount_accrued as total'),
      db('audit_logs')
        .leftJoin('users', 'audit_logs.actor_id', 'users.id')
        .select('audit_logs.*', 'users.name as actor_name')
        .orderBy('audit_logs.created_at', 'desc')
        .limit(10),
      db('loans')
        .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
        .leftJoin('users as agents', 'loans.assigned_agent_id', 'agents.id')
        .where('loans.status', 'active')
        .andWhere('loans.next_accrual_date', '<', now)
        .select('loans.*', 'borrowers.name as borrower_name', 'agents.name as agent_name'),
      db('interest_accruals')
        .join('loans', 'interest_accruals.loan_id', 'loans.id')
        .select('loans.interest_type')
        .sum('interest_accruals.amount_accrued as total')
        .groupBy('loans.interest_type'),
      db('interest_accruals')
        .join('loans', 'interest_accruals.loan_id', 'loans.id')
        .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
        .select('interest_accruals.*', 'borrowers.name as borrower_name', 'loans.principal_amount', 'loans.interest_rate', 'loans.interest_type')
        .orderBy('interest_accruals.created_at', 'desc')
        .limit(10),
      db('remittances').where('status', 'verified').sum('amount as total'),
      db('loans').where({ status: 'active' }).select('id', 'principal_amount', 'interest_rate', 'interest_type', 'created_at', 'last_accrual_date', 'interest_balance'),
      db('loans')
        .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
        .leftJoin('users as agents', 'loans.lender_id', 'agents.id')
        .where('loans.status', 'pending')
        .select('loans.*', 'borrowers.name as borrower_name', 'borrowers.phone as borrower_phone', 'agents.name as submitted_by_name')
        .orderBy('loans.created_at', 'asc')
    ]);

    const totalMoneyLent = parseFloat(moneyLentResult[0].total) || 0;
    const totalActiveLoans = parseInt(activeLoansResult[0].count) || 0;
    const totalRepayments = parseFloat(repaymentsResult[0].total) || 0;
    const totalOverdue = parseInt(overdueResult[0].count) || 0;
    const totalPrincipalOutstanding = parseFloat(outstandingResult[0].principal) || 0;
    const totalInterestDue = parseFloat(outstandingResult[0].interest) || 0;
    const collectionsToday = parseFloat(collectionsTodayResult[0].total) || 0;
    const interestToday = parseFloat(interestTodayResult[0].total) || 0;
    const totalVerifiedRemittances = parseFloat(remittancesResult[0].total) || 0;
    const agentCashInHand = Math.max(0, totalRepayments - totalVerifiedRemittances);

    // Calculate today's target collection
    let expectedTodayTarget = 0;
    let totalOverdueAmount = 0;
    (activeLoansList || []).forEach(l => {
      const p = parseFloat(l.principal_amount) || 0;
      const r = parseFloat(l.interest_rate) || 0;
      const totalPeriodInterest = (p * r) / 100;
      
      if (l.interest_type === 'daily') {
        expectedTodayTarget += (totalPeriodInterest / 30);
      } else if (l.interest_type === 'weekly') {
        expectedTodayTarget += (totalPeriodInterest / 4);
      } else {
        expectedTodayTarget += totalPeriodInterest;
      }

      const lastAcc = l.last_accrual_date ? new Date(l.last_accrual_date) : new Date(l.created_at);
      const diffDays = Math.floor((now - lastAcc) / (1000 * 60 * 60 * 24));
      if (diffDays >= 3) {
        totalOverdueAmount += parseFloat(l.interest_balance || 0);
      }
    });

    const overdueLoans = stripLoanMediaList(overdueLoansRaw);
    const pendingApprovals = stripLoanMediaList(pendingApprovalsRaw);

    return NextResponse.json({
      summary: {
        totalMoneyLent,
        totalActiveLoans,
        totalRepayments,
        totalOverdue,
        totalOverdueAmount,
        totalPrincipalOutstanding,
        totalInterestDue,
        totalOutstanding: totalPrincipalOutstanding + totalInterestDue,
        agentCashInHand,
        expectedTodayTarget: Math.round(expectedTodayTarget),
        pendingApprovalsCount: pendingApprovals.length
      },
      dailyReport: { collectionsToday, interestToday, expectedTodayTarget: Math.round(expectedTodayTarget), date: todayStart.toDateString() },
      agentPerformance,
      overdueLoans,
      pendingApprovals,
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
