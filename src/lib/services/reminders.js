import db from '../db.js';
import { notifyPaymentReminder } from './notification.js';

/**
 * Sends a reminder SMS to borrowers whose interest has been outstanding for
 * at least the org's configured threshold. Run once daily via Vercel Cron —
 * see app/api/cron/payment-reminders and vercel.json.
 *
 * Two things this deliberately does NOT do, both fixed here after an audit
 * found them firing on every single active loan with any balance, every day:
 *
 * 1. Daily/flat-installment loans are excluded entirely. Their
 *    interest_balance is nonzero on almost every day of the loan's life by
 *    design (the whole term's interest is bundled into the daily amount
 *    from day one) — reminding a borrower every morning about a balance
 *    that's supposed to be there is just noise, same reasoning already
 *    applied to the payment-received SMS in notification.js.
 * 2. Every other loan only gets a reminder once it's been overdue for at
 *    least org_settings.overdue_reminder_threshold_days — "overdue" meaning
 *    days since the loan's last payment (or since disbursement, if it's
 *    never had one). Previously this fired daily on any nonzero balance
 *    with no threshold at all, and the admin-facing "Overdue Reminder
 *    Threshold" setting that implies otherwise didn't actually connect to
 *    anything server-side.
 */
export async function runPaymentReminders() {
  console.log('Running payment reminder checks...');

  const orgSettings = await db('org_settings').first();
  const thresholdDays = orgSettings?.overdue_reminder_threshold_days ?? 3;

  const loans = await db('loans')
    .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
    .where('loans.status', 'active')
    .andWhere('loans.interest_balance', '>', 0)
    .andWhere('loans.is_flat_installment', false)
    .andWhereNot('loans.interest_type', 'daily')
    .select(
      'loans.id',
      'loans.interest_balance',
      'loans.interest_type',
      'loans.created_at as loan_created_at',
      'borrowers.id as borrower_id',
      'borrowers.name as borrower_name',
      'borrowers.phone as borrower_phone',
      db.raw(`(
        SELECT MAX(payment_date) FROM transactions
        WHERE transactions.loan_id = loans.id
      ) as last_payment_date`)
    );

  console.log(`Found ${loans.length} active non-daily loans with outstanding interest.`);

  const now = new Date();
  const results = [];
  for (const loan of loans) {
    const sinceDate = loan.last_payment_date ? new Date(loan.last_payment_date) : new Date(loan.loan_created_at);
    const daysSince = Math.floor((now - sinceDate) / (1000 * 60 * 60 * 24));

    if (daysSince < thresholdDays) {
      results.push({ loanId: loan.id, status: 'skipped', reason: `only ${daysSince}d since last payment, threshold is ${thresholdDays}d` });
      continue;
    }

    try {
      await notifyPaymentReminder({
        borrower: { name: loan.borrower_name, phone: loan.borrower_phone },
        interestBalance: loan.interest_balance,
        interestType: loan.interest_type
      });
      results.push({ loanId: loan.id, status: 'sent', daysSince });
    } catch (err) {
      console.error(`Error sending reminder for loan ID ${loan.id}:`, err);
      results.push({ loanId: loan.id, status: 'error', error: err.message });
    }
  }

  return results;
}
