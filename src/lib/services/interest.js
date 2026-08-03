import db from '../db.js';

/**
 * Accrues interest for all active loans whose next_accrual_date is in the past.
 * Executed in a transaction for each loan to ensure integrity.
 *
 * Called from the Vercel Cron route (app/api/cron/accrue-interest) instead of
 * a setInterval loop — serverless functions don't stay alive between requests.
 */
export async function runInterestAccruals() {
  console.log('Running interest accrual checks...');
  const activeLoans = await db('loans')
    .where('status', 'active')
    .andWhere('next_accrual_date', '<=', db.fn.now());

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

        // Calculate interest: principal * (rate / 100). Interest-only model —
        // this adds to interest_balance (a separate, recurring obligation),
        // never to principal_outstanding. The borrower keeps paying this
        // periodic interest for as long as the loan is open; principal is
        // only ever reduced by an explicit principal payment.
        const principal = parseFloat(dbLoan.principal_amount);
        const rate = parseFloat(dbLoan.interest_rate);
        const interestAmount = principal * (rate / 100);

        const newInterestBalance = parseFloat(dbLoan.interest_balance) + interestAmount;

        // Calculate next accrual date based on type
        const nextDate = new Date(dbLoan.next_accrual_date);
        if (dbLoan.interest_type === 'daily') {
          nextDate.setDate(nextDate.getDate() + 1);
        } else if (dbLoan.interest_type === 'weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        } else if (dbLoan.interest_type === 'monthly') {
          nextDate.setDate(nextDate.getDate() + 30);
        }

        // 1. Insert Interest Accrual Log
        const logText = `Principal: ${principal} | Rate: ${rate}% | Type: ${dbLoan.interest_type}`;
        await trx('interest_accruals').insert({
          loan_id: dbLoan.id,
          amount_accrued: interestAmount,
          calculation_log: logText
        });

        // 2. Post Ledger Entries (Double-Entry Ledger)
        // A: Debit loan_receivable (Asset increases)
        // B: Credit interest_revenue (Revenue increases)
        await trx('ledger_entries').insert([
          {
            loan_id: dbLoan.id,
            account: 'loan_receivable',
            type: 'debit',
            amount: interestAmount
          },
          {
            loan_id: dbLoan.id,
            account: 'interest_revenue',
            type: 'credit',
            amount: interestAmount
          }
        ]);

        // 3. Update Loan Row
        await trx('loans')
          .where({ id: dbLoan.id })
          .update({
            interest_balance: newInterestBalance,
            last_accrual_date: db.fn.now(),
            next_accrual_date: nextDate,
            updated_at: db.fn.now()
          });

        // 4. Create Audit Log
        await trx('audit_logs').insert({
          actor_id: dbLoan.lender_id, // Assigned to Lender Admin
          action_type: 'ACCRUE_INTEREST',
          description: `Accrued interest of LKR ${interestAmount.toLocaleString()} on loan of LKR ${principal.toLocaleString()} for Borrower. Outstanding interest due: LKR ${newInterestBalance.toLocaleString()}.`
        });

        return { loanId: dbLoan.id, accruedAmount: interestAmount, status: 'accrued' };
      });
      results.push(result);
    } catch (err) {
      console.error(`Error accruing interest for loan ID ${loan.id}:`, err);
      results.push({ loanId: loan.id, error: err.message, status: 'error' });
    }
  }

  return results;
}
