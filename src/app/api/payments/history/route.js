import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';

export async function GET(request) {
  try {
    const { role, id } = requireAuth(request);
    const borrowerId = request.nextUrl.searchParams.get('borrowerId');
    const agentId = request.nextUrl.searchParams.get('agentId');

    let query = db('transactions')
      .join('loans', 'transactions.loan_id', 'loans.id')
      .join('users as borrowers', 'transactions.borrower_id', 'borrowers.id')
      .join('users as agents', 'transactions.agent_id', 'agents.id')
      .select(
        'transactions.*',
        'borrowers.name as borrower_name',
        'borrowers.phone as borrower_phone',
        'borrowers.email as borrower_email',
        'agents.name as agent_name',
        'loans.principal_amount as loan_principal',
        'loans.interest_rate as loan_interest_rate',
        'loans.interest_type as loan_interest_type',
        'loans.current_balance as loan_current_balance',
        'loans.status as loan_status'
      );

    if (role === 'agent') {
      query = query.where('transactions.agent_id', id);
    } else if (role === 'borrower') {
      query = query.where('transactions.borrower_id', id);
    }

    if (borrowerId && role === 'admin') query = query.where('transactions.borrower_id', borrowerId);
    if (agentId && role === 'admin') query = query.where('transactions.agent_id', agentId);

    const history = await query.orderBy('transactions.payment_date', 'desc');
    return NextResponse.json(history);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Fetch payment history error:', error);
    return NextResponse.json({ message: 'Failed to retrieve payment history.' }, { status: 500 });
  }
}
