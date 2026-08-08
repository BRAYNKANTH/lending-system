import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { getAgentCashInHand } from '@/lib/services/remittance.js';

export async function GET(request) {
  try {
    const authUser = await requireAuth(request, ['agent']);
    const agentId = authUser.id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const collectionsTodayResult = await db('transactions')
      .where({ agent_id: agentId })
      .andWhere('payment_date', '>=', todayStart)
      .sum('amount as total');
    const collectionsToday = parseFloat(collectionsTodayResult[0].total) || 0;

    // All statuses, not just active — the UI toggles between Active,
    // Defaulted, and Closed (fully_paid/written_off) tabs. Previously this
    // hardcoded status='active', so agents could never see a defaulted or
    // closed loan on their own route at all.
    const assignedLoans = await db('loans')
      .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
      .where({ assigned_agent_id: agentId })
      .select('loans.*', 'borrowers.name as borrower_name', 'borrowers.phone as borrower_phone')
      .orderBy('loans.principal_outstanding', 'desc');

    // Today's collection-tracker status per loan, for the daily checklist
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayMarks = assignedLoans.length
      ? await db('daily_collections')
        .whereIn('loan_id', assignedLoans.map((l) => l.id))
        .andWhere('collection_date', todayStr)
      : [];
    const todayMarkByLoanId = Object.fromEntries(todayMarks.map((m) => [m.loan_id, m]));
    for (const loan of assignedLoans) {
      loan.today_collection_status = todayMarkByLoanId[loan.id]?.status || null;
    }

    const collectionHistory = await db('transactions')
      .join('users as borrowers', 'transactions.borrower_id', 'borrowers.id')
      .where({ agent_id: agentId })
      .select('transactions.*', 'borrowers.name as borrower_name')
      .orderBy('transactions.payment_date', 'desc')
      .limit(10);

    const cashInHand = await getAgentCashInHand(agentId);
    const activeCount = assignedLoans.filter((l) => l.status === 'active').length;

    return NextResponse.json({
      summary: { collectionsToday, assignedCount: activeCount, ...cashInHand },
      assignedLoans,
      collectionHistory
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Agent dashboard error:', error);
    return NextResponse.json({ message: 'Failed to build agent dashboard statistics.' }, { status: 500 });
  }
}
