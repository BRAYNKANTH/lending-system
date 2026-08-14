import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { getAgentCashInHand } from '@/lib/services/remittance.js';
import { stripLoanMediaList, stripTransactionMediaList } from '@/lib/stripMedia.js';
import { getSriLankaTodayRange } from '@/lib/loanSchedule.js';
import { logError } from '@/lib/logger.js';

export async function GET(request) {
  try {
    const authUser = await requireAuth(request, ['agent']);
    const agentId = authUser.id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { start: slTodayStart, end: slTodayEnd } = getSriLankaTodayRange();

    // These four don't depend on each other — run concurrently instead of
    // as four sequential round-trips.
    const [collectionsTodayResult, assignedLoansRaw, collectionHistoryRaw, cashInHand] = await Promise.all([
      db('transactions')
        .where({ agent_id: agentId })
        .andWhere('payment_date', '>=', todayStart)
        .sum('amount as total'),
      // All statuses, not just active — the UI toggles between Active,
      // Defaulted, and Closed (fully_paid/written_off) tabs. Previously this
      // hardcoded status='active', so agents could never see a defaulted or
      // closed loan on their own route at all.
      //
      // paid_today backs the Remaining/Done split on Record Payment — checked
      // against transactions directly (not daily_collections below, a
      // separate/narrower tracker that only the daily-collection-mark
      // endpoint writes to) since that's what the normal payment save flow
      // actually records.
      db('loans')
        .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
        .where({ assigned_agent_id: agentId })
        .select(
          'loans.*', 'borrowers.name as borrower_name', 'borrowers.phone as borrower_phone',
          db.raw(
            `EXISTS (
              SELECT 1 FROM transactions
              WHERE transactions.loan_id = loans.id
                AND transactions.payment_date >= ?
                AND transactions.payment_date < ?
            ) as paid_today`,
            [slTodayStart, slTodayEnd]
          )
        )
        .orderBy('loans.principal_outstanding', 'desc'),
      db('transactions')
        .join('users as borrowers', 'transactions.borrower_id', 'borrowers.id')
        .where({ agent_id: agentId })
        .select('transactions.*', 'borrowers.name as borrower_name')
        .orderBy('transactions.payment_date', 'desc')
        .limit(10),
      getAgentCashInHand(agentId)
    ]);

    const collectionsToday = parseFloat(collectionsTodayResult[0].total) || 0;
    // Neither the loan list nor the collection history displays NIC/proof
    // photos — stripped so agents aren't downloading several MB of base64
    // images every time they open their dashboard.
    const assignedLoans = stripLoanMediaList(assignedLoansRaw);
    const collectionHistory = stripTransactionMediaList(collectionHistoryRaw);

    // Today's collection-tracker status per loan, for the daily checklist —
    // depends on assignedLoans' IDs, so this one has to come after.
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

    const activeCount = assignedLoans.filter((l) => l.status === 'active').length;

    return NextResponse.json({
      summary: { collectionsToday, assignedCount: activeCount, ...cashInHand },
      assignedLoans,
      collectionHistory
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Agent dashboard error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Failed to build agent dashboard statistics.' }, { status: 500 });
  }
}
