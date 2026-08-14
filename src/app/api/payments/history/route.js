import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { stripTransactionMediaList } from '@/lib/stripMedia.js';
import { logError } from '@/lib/logger.js';

export async function GET(request) {
  try {
    const { role, id } = await requireAuth(request);
    const borrowerId = request.nextUrl.searchParams.get('borrowerId');
    const agentId = request.nextUrl.searchParams.get('agentId');
    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');
    const search = request.nextUrl.searchParams.get('search');
    const paymentMethod = request.nextUrl.searchParams.get('paymentMethod');
    const paymentType = request.nextUrl.searchParams.get('paymentType');

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

    if (from) baseQuery = baseQuery.where('transactions.payment_date', '>=', new Date(from));
    if (to) {
      const endTo = new Date(to);
      endTo.setHours(23, 59, 59, 999);
      baseQuery = baseQuery.where('transactions.payment_date', '<=', endTo);
    }
    if (paymentMethod) baseQuery = baseQuery.where('transactions.payment_method', paymentMethod);
    if (paymentType) baseQuery = baseQuery.where('transactions.payment_type', paymentType);
    if (search) {
      const q = `%${search.trim()}%`;
      baseQuery = baseQuery.andWhere(function() {
        this.where('borrowers.name', 'like', q)
          .orWhere('borrowers.phone', 'like', q)
          .orWhere('loans.nic_number', 'like', q)
          .orWhere('loans.reference_number', 'like', q)
          .orWhere('transactions.idempotency_key', 'like', q);
      });
    }

    const [countResult, historyRaw] = await Promise.all([
      baseQuery.clone().count('transactions.id as count').first(),
      baseQuery.clone()
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
        .offset((page - 1) * limit)
    ]);
    const total = parseInt(countResult.count, 10) || 0;
    // Receipt photos aren't shown in the history table — stripped here too.
    const history = stripTransactionMediaList(historyRaw);

    return NextResponse.json({ data: history, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Fetch payment history error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Failed to retrieve payment history.' }, { status: 500 });
  }
}
