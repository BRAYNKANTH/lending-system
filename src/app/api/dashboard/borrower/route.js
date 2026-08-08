import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';

export async function GET(request) {
  try {
    const authUser = await requireAuth(request, ['borrower']);
    const borrowerId = authUser.id;

    // Get borrower's active/past loans
    const loans = await db('loans')
      .leftJoin('users as agents', 'loans.assigned_agent_id', 'agents.id')
      .where({ 'loans.borrower_id': borrowerId })
      .select('loans.*', 'agents.name as agent_name')
      .orderBy('loans.created_at', 'desc');

    const activeLoans = loans.filter(l => l.status === 'active');

    // Calculate totals
    const totalPrincipalOutstanding = activeLoans.reduce((sum, l) => sum + (parseFloat(l.principal_outstanding) || 0), 0);
    const totalInterestBalance = activeLoans.reduce((sum, l) => sum + (parseFloat(l.interest_balance) || 0), 0);

    // Get recent payments
    const recentTransactions = await db('transactions')
      .join('loans', 'transactions.loan_id', 'loans.id')
      .leftJoin('users as agents', 'transactions.agent_id', 'agents.id')
      .where({ 'transactions.borrower_id': borrowerId })
      .select('transactions.*', 'agents.name as agent_name')
      .orderBy('transactions.payment_date', 'desc')
      .limit(15);

    return NextResponse.json({
      summary: {
        totalPrincipalOutstanding,
        totalInterestBalance,
        activeLoansCount: activeLoans.length
      },
      loans,
      recentTransactions
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Borrower dashboard error:', error);
    return NextResponse.json({ message: 'Failed to retrieve borrower dashboard.' }, { status: 500 });
  }
}
