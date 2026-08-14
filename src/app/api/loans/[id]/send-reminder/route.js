import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { notifyPaymentReminder } from '@/lib/services/notification.js';
import { logError } from '@/lib/logger.js';

// Manual "Send Alert" button on the Overdue Loans table (Admin only). Used
// to genuinely be fake — the frontend just showed a toast claiming an SMS
// went out without calling any API at all, so an admin clicking it believed
// a borrower had been reminded when nothing had actually happened. This
// route makes it real, using the same daily-loan exclusion the automated
// reminder cron uses (see runPaymentReminders in reminders.js) — a manual
// nudge on a daily/flat-installment loan is logged instead of texted, same
// as the automated path, since that balance is expected to be nonzero
// almost every day of the loan's term.
export async function POST(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin', 'agent']);
    const { id } = params;

    const loan = await db('loans').where({ id }).first();
    if (!loan) {
      return NextResponse.json({ message: 'Loan not found.' }, { status: 404 });
    }
    if (authUser.role === 'agent' && loan.assigned_agent_id !== authUser.id) {
      return NextResponse.json({ message: 'This loan is not assigned to you.' }, { status: 403 });
    }
    if (loan.status !== 'active') {
      return NextResponse.json({ message: `Reminders can only be sent for active loans (current status: '${loan.status}').` }, { status: 400 });
    }

    const borrower = await db('users').where({ id: loan.borrower_id }).first();
    if (!borrower) {
      return NextResponse.json({ message: 'Borrower record not found.' }, { status: 404 });
    }

    const isDaily = loan.interest_type === 'daily' || loan.is_flat_installment;
    if (!isDaily) {
      await notifyPaymentReminder({
        borrower: { name: borrower.name, phone: borrower.phone },
        interestBalance: loan.interest_balance,
        interestType: loan.interest_type
      });
    }

    await db('audit_logs').insert({
      actor_id: authUser.id,
      action_type: 'MANUAL_REMINDER_SENT',
      description: isDaily
        ? `Manual overdue check logged for ${borrower.name} on loan ID ${id} — no SMS sent (daily/flat-installment loan).`
        : `Manual overdue reminder SMS sent to ${borrower.name} (${borrower.phone}) for loan ID ${id}.`
    });

    return NextResponse.json({
      message: isDaily
        ? 'Logged — no SMS sent for daily/flat-installment loans.'
        : 'Reminder SMS sent.',
      smsSent: !isDaily
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Send reminder error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Internal server error while sending reminder.' }, { status: 500 });
  }
}
