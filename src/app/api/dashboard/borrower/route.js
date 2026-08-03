import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';

export async function GET(request) {
  try {
    const authUser = requireAuth(request, ['borrower']);
    const borrowerId = authUser.id;

    const loans = await db('loans')
      .leftJoin('users as agents', 'loans.assigned_agent_id', 'agents.id')
      .where({ borrower_id: borrowerId })
      .select('loans.*', 'agents.name as agent_name', 'agents.phone as agent_phone')
      .orderBy('loans.created_at', 'desc');

    const payments = await db('transactions')
      .join('users as agents', 'transactions.agent_id', 'agents.id')
      .where({ borrower_id: borrowerId })
      .select('transactions.*', 'agents.name as agent_name')
      .orderBy('transactions.payment_date', 'desc');

    const activeLoans = loans.filter((l) => l.status === 'active');
    const totalPrincipalOutstanding = activeLoans.reduce((sum, l) => sum + parseFloat(l.principal_outstanding), 0);
    const totalInterestDue = activeLoans.reduce((sum, l) => sum + parseFloat(l.interest_balance), 0);
    const totalOutstanding = totalPrincipalOutstanding + totalInterestDue;
    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const interestByType = await db('interest_accruals')
      .join('loans', 'interest_accruals.loan_id', 'loans.id')
      .where('loans.borrower_id', borrowerId)
      .select('loans.interest_type')
      .sum('interest_accruals.amount_accrued as total')
      .groupBy('loans.interest_type');

    const recentAccruals = await db('interest_accruals')
      .join('loans', 'interest_accruals.loan_id', 'loans.id')
      .where('loans.borrower_id', borrowerId)
      .select('interest_accruals.*', 'loans.principal_amount', 'loans.interest_rate', 'loans.interest_type')
      .orderBy('interest_accruals.created_at', 'desc')
      .limit(10);

    return NextResponse.json({
      summary: { totalOutstanding, totalPrincipalOutstanding, totalInterestDue, totalPaid, activeLoansCount: activeLoans.length },
      loans,
      payments,
      interestByType,
      recentAccruals
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Borrower dashboard error:', error);
    return NextResponse.json({ message: 'Failed to build borrower dashboard statistics.' }, { status: 500 });
  }
}
