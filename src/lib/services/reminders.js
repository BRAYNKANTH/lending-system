import db from '../db.js';
import { notifyPaymentReminder } from './notification.js';

/**
 * Sends a reminder SMS to every borrower with an active loan that has
 * outstanding interest due. Run once daily via Vercel Cron — see
 * app/api/cron/payment-reminders and vercel.json.
 */
export async function runPaymentReminders() {
  console.log('Running payment reminder checks...');

  const loans = await db('loans')
    .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
    .where('loans.status', 'active')
    .andWhere('loans.interest_balance', '>', 0)
    .select(
      'loans.id',
      'loans.interest_balance',
      'loans.interest_type',
      'borrowers.id as borrower_id',
      'borrowers.name as borrower_name',
      'borrowers.phone as borrower_phone'
    );

  console.log(`Found ${loans.length} active loans with outstanding interest.`);

  const results = [];
  for (const loan of loans) {
    try {
      await notifyPaymentReminder({
        borrower: { name: loan.borrower_name, phone: loan.borrower_phone },
        interestBalance: loan.interest_balance,
        interestType: loan.interest_type
      });
      results.push({ loanId: loan.id, status: 'sent' });
    } catch (err) {
      console.error(`Error sending reminder for loan ID ${loan.id}:`, err);
      results.push({ loanId: loan.id, status: 'error', error: err.message });
    }
  }

  return results;
}
