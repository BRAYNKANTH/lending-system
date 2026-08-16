import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { addInterval } from '@/lib/loanSchedule.js';
import { notifyLoanTermExtended } from '@/lib/services/notification.js';
import { logError } from '@/lib/logger.js';

// Restructures a struggling fixed-term loan by giving it more calendar time
// — "extend term" only, deliberately the narrowest possible restructuring
// option: the periodic payment amount (daily_installment_amount for a Flat
// Installment loan, or the plain periodic interest for any other
// fixed-term loan) is never touched here, only duration_periods and
// maturity_date move. Nothing about collecting money changes; nothing in
// the codebase actually enforces duration_periods as a hard cap on
// payments (verified: neither the daily-collection route nor the general
// payments route reference it) — its only real effects are (1) capping
// interest accrual at maturity_date for non-flat loans (see
// computeAccrualBatch in interest.js) and (2) driving the "how many days
// behind schedule is this loan" math for missed-payment alerts (see
// runMissedDailyCollectionAlerts in reminders.js). Extending both simply
// gives the loan more runway on both of those before it's flagged as
// behind — an admin action for a borrower who needs more time, not a
// renegotiation of what they owe or pay per period.
export async function POST(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin']);
    const { id } = params;
    const { additionalPeriods, reason } = await request.json();

    const extendBy = parseInt(additionalPeriods, 10);
    if (!Number.isInteger(extendBy) || extendBy <= 0) {
      return NextResponse.json({ message: 'additionalPeriods must be a positive whole number.' }, { status: 400 });
    }
    if (!reason || !reason.trim()) {
      return NextResponse.json({ message: 'A reason is required to extend a loan term.' }, { status: 400 });
    }

    const result = await db.transaction(async (trx) => {
      const loan = await trx('loans').where({ id }).first().forUpdate();
      if (!loan) {
        throw new Error('Loan not found.');
      }
      if (loan.status !== 'active') {
        throw new Error(`Only an active loan's term can be extended (current status: '${loan.status}'). Reinstate a defaulted loan first.`);
      }
      if (loan.collection_mode !== 'fixed_term' || !loan.duration_periods) {
        throw new Error('This is an open-ended loan — it has no fixed term to extend.');
      }

      const oldDuration = loan.duration_periods;
      const oldMaturityDate = loan.maturity_date;
      const newDuration = oldDuration + extendBy;

      // Mirrors the exact maturity-date formula used at loan creation (see
      // POST /api/loans) so a restructured loan's maturity date is computed
      // identically to how it would have been had it been created with the
      // new, longer duration from day one.
      const newMaturityDate = loan.is_flat_installment
        ? addInterval(new Date(loan.created_at), loan.interest_type, newDuration - 1)
        : addInterval(new Date(loan.created_at), loan.interest_type, newDuration);

      await trx('loans').where({ id }).update({
        duration_periods: newDuration,
        maturity_date: newMaturityDate,
        updated_at: trx.fn.now()
      });

      const periodUnit = loan.interest_type === 'daily' ? 'day' : loan.interest_type === 'weekly' ? 'week' : 'month';
      await trx('audit_logs').insert({
        actor_id: authUser.id,
        action_type: 'EXTEND_LOAN_TERM',
        description: `Extended loan ID ${id}'s term by ${extendBy} ${periodUnit}${extendBy === 1 ? '' : 's'} (${oldDuration} → ${newDuration} total periods; maturity date ${oldMaturityDate ? new Date(oldMaturityDate).toLocaleDateString() : 'n/a'} → ${new Date(newMaturityDate).toLocaleDateString()}). Payment amount unchanged. Reason: ${reason.trim()}.`
      });

      const borrower = await trx('users').where({ id: loan.borrower_id }).first();
      return { loan: { ...loan, duration_periods: newDuration, maturity_date: newMaturityDate }, borrower, extendBy, periodUnit };
    });

    if (result.borrower) {
      await notifyLoanTermExtended({
        borrower: result.borrower,
        extendBy: result.extendBy,
        periodUnit: result.periodUnit,
        newMaturityDate: result.loan.maturity_date,
        installmentAmount: result.loan.is_flat_installment ? result.loan.daily_installment_amount : null
      });
    }

    return NextResponse.json({ message: 'Loan term extended.', loan: result.loan });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Extend loan term error', error, { method: request.method, url: request.url });
    if (error.message?.includes('not found') || error.message?.includes('can be extended') || error.message?.includes('no fixed term')) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Internal server error while extending loan term.' }, { status: 500 });
  }
}
