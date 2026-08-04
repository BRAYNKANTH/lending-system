import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';

export async function GET(request) {
  try {
    const { role, id } = requireAuth(request);
    const borrowerId = request.nextUrl.searchParams.get('borrowerId');
    const agentId = request.nextUrl.searchParams.get('agentId');
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit'), 10) || 25));

    let baseQuery = db('transactions')
      .join('loans', 'transactions.loan_id', 'loans.id')
      .join('users as borrowers', 'transactions.borrower_id', 'borrowers.id')
      .join('users as agents', 'transactions.agent_id', 'agents.id');

    if (role === 'agent') {
      baseQuery = baseQuery.where('transactions.agent_id', id);
    } else if (role === 'borrower') {
      baseQuery = baseQuery.where('transactions.borrower_id', id);
    }
    if (borrowerId && role === 'admin') baseQuery = baseQuery.where('transactions.borrower_id', borrowerId);
    if (agentId && role === 'admin') baseQuery = baseQuery.where('transactions.agent_id', agentId);

    const countResult = await baseQuery.clone().count('transactions.id as count').first();
    const total = parseInt(countResult.count, 10) || 0;

    const history = await baseQuery.clone()
      .select(
        'transactions.*',
        'borrowers.name as borrower_name',
        'borrowers.phone as borrower_phone',
        'borrowers.email as borrower_email',
        'agents.name as agent_name',
        'loans.principal_amount as loan_principal',
        'loans.interest_rate as loan_interest_rate',
        'loans.interest_type as loan_interest_type',
        'loans.principal_outstanding as loan_principal_outstanding',
        'loans.interest_balance as loan_interest_balance',
        'loans.status as loan_status'
      )
      .orderBy('transactions.payment_date', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    return NextResponse.json({ data: history, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Fetch payment history error:', error);
    return NextResponse.json({ message: 'Failed to retrieve payment history.' }, { status: 500 });
  }
}
