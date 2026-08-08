import db from '../db.js';

/**
 * Accrues interest for all active loans whose next_accrual_date is in the past.
 * Executed in a transaction for each loan to ensure integrity.
 *
 * Called from the Vercel Cron route (app/api/cron/accrue-interest) instead of
 * a setInterval loop — serverless functions don't stay alive between requests.
 *
 * Pass `loanId` to scope this to a single loan instead of sweeping every
 * active loan in the system — used when a loan's detail page wants an
 * up-to-date balance without paying the cost of processing every OTHER
 * loan too. Without it, this was running a full system-wide accrual sweep
 * on every single loan detail page view, getting more expensive as the
 * loan book grows regardless of which one loan was actually being looked at.
 */
export async function runInterestAccruals(loanId) {
  console.log(loanId ? `Running interest accrual check for loan ${loanId}...` : 'Running interest accrual checks...');
  let query = db('loans')
    .where('status', 'active')
    .andWhere('next_accrual_date', '<=', db.fn.now());
  if (loanId) query = query.andWhere('id', loanId);
  const activeLoans = await query;

  console.log(`Found ${activeLoans.length} loans qualifying for interest accrual.`);

  const results = [];

  for (const loan of activeLoans) {
    try {
      const result = await db.transaction(async (trx) => {
        // Lock row
        const dbLoan = await trx('loans').where({ id: loan.id }).first().forUpdate();

        // Re-verify conditions
        if (dbLoan.status !== 'active' || new Date(dbLoan.next_accrual_date) > new Date()) {
          return { loanId: loan.id, status: 'skipped' };
        }

        // Catch up on every missed period in one pass, not just one. Cron
        // only fires once — if it doesn't run for a few days (a Vercel
        // outage, a bug, etc.), a single-period accrual would otherwise take
        // that many additional daily cron runs to fully catch up, silently
        // under-accruing interest in the meantime. Capped at 500 periods as
        // a sanity ceiling against a corrupted next_accrual_date.
        const principal = parseFloat(dbLoan.principal_amount);
        const rate = parseFloat(dbLoan.interest_rate);
        const interestPerPeriod = principal * (rate / 100);

        let periodsAccrued = 0;
        let totalAccrued = 0;
        let runningInterestBalance = parseFloat(dbLoan.interest_balance);
        let nextDate = new Date(dbLoan.next_accrual_date);
        const now = new Date();

        while (nextDate <= now && periodsAccrued < 500) {
          if (dbLoan.maturity_date && nextDate > new Date(dbLoan.maturity_date)) {
            break;
          }
          runningInterestBalance += interestPerPeriod;
          totalAccrued += interestPerPeriod;
          periodsAccrued += 1;

          const logText = `Principal: ${principal} | Rate: ${rate}% | Type: ${dbLoan.interest_type} | Accrual period for ${nextDate.toISOString().slice(0, 10)}`;
          await trx('interest_accruals').insert({
            loan_id: dbLoan.id,
            amount_accrued: interestPerPeriod,
            calculation_log: logText
          });

          if (dbLoan.interest_type === 'daily') {
            nextDate.setDate(nextDate.getDate() + 1);
          } else if (dbLoan.interest_type === 'weekly') {
            nextDate.setDate(nextDate.getDate() + 7);
          } else if (dbLoan.interest_type === 'monthly') {
            nextDate.setMonth(nextDate.getMonth() + 1);
          } else {
            break; // unknown interest_type — avoid an infinite loop
          }
          nextDate.setHours(0, 0, 0, 0); // Keep nextDate aligned to midnight
        }

        if (periodsAccrued === 0) {
          return { loanId: loan.id, status: 'skipped' };
        }

        // Post Ledger Entries (Double-Entry Ledger) — one combined posting
        // for the whole catch-up batch.
        // A: Debit loan_receivable_interest (Asset increases)
        // B: Credit interest_revenue (Revenue increases)
        await trx('ledger_entries').insert([
          {
            loan_id: dbLoan.id,
            account: 'loan_receivable_interest',
            type: 'debit',
            amount: totalAccrued
          },
          {
            loan_id: dbLoan.id,
            account: 'interest_revenue',
            type: 'credit',
            amount: totalAccrued
          }
        ]);

        // Update Loan Row
        await trx('loans')
          .where({ id: dbLoan.id })
          .update({
            interest_balance: runningInterestBalance,
            last_accrual_date: db.fn.now(),
            next_accrual_date: nextDate,
            updated_at: db.fn.now()
          });

        // Create Audit Log
        await trx('audit_logs').insert({
          actor_id: dbLoan.lender_id, // Assigned to Lender Admin
          action_type: 'ACCRUE_INTEREST',
          description: periodsAccrued > 1
            ? `Accrued interest for ${periodsAccrued} missed periods (LKR ${totalAccrued.toLocaleString()} total) on loan of LKR ${principal.toLocaleString()} for Borrower. Outstanding interest due: LKR ${runningInterestBalance.toLocaleString()}.`
            : `Accrued interest of LKR ${totalAccrued.toLocaleString()} on loan of LKR ${principal.toLocaleString()} for Borrower. Outstanding interest due: LKR ${runningInterestBalance.toLocaleString()}.`
        });

        return { loanId: dbLoan.id, accruedAmount: totalAccrued, periodsAccrued, status: 'accrued' };
      });
      results.push(result);
    } catch (err) {
      console.error(`Error accruing interest for loan ID ${loan.id}:`, err);
      results.push({ loanId: loan.id, error: err.message, status: 'error' });
    }
  }

  return results;
}
