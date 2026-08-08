import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';

// Writes off a loan's remaining principal + interest as unrecoverable bad
// debt (Admin only). Previously, a defaulted loan's principal_outstanding
// and interest_balance sat on the books forever — loan_receivable on the
// trial-balance report permanently overstated recoverable assets, with no
// way to formally close the books on money that will never be collected.
// This posts the write-off to the ledger and zeroes the loan's own
// outstanding balances, while preserving what was written off for the
// historical record.
export async function POST(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin']);
    const { id } = params;
    const { reason } = await request.json();

    if (!reason || !reason.trim()) {
      return NextResponse.json({ message: 'A reason is required to write off a loan.' }, { status: 400 });
    }

    const result = await db.transaction(async (trx) => {
      const loan = await trx('loans').where({ id }).first().forUpdate();
      if (!loan) {
        throw new Error('Loan not found.');
      }
      if (!['active', 'defaulted'].includes(loan.status)) {
        throw new Error(`Only active or defaulted loans can be written off (current status: '${loan.status}').`);
      }

      const principal = parseFloat(loan.principal_outstanding);
      const interest = parseFloat(loan.interest_balance);
      const totalWriteOff = principal + interest;

      if (totalWriteOff <= 0) {
        throw new Error('This loan has no outstanding balance to write off.');
      }

      // One combined expense debit, split across both receivable accounts
      // it's clearing — keeps debits == credits while still crediting the
      // correct principal vs. interest receivable.
      const ledgerRows = [{ loan_id: id, account: 'written_off_expense', type: 'debit', amount: totalWriteOff }];
      if (principal > 0) ledgerRows.push({ loan_id: id, account: 'loan_receivable_principal', type: 'credit', amount: principal });
      if (interest > 0) ledgerRows.push({ loan_id: id, account: 'loan_receivable_interest', type: 'credit', amount: interest });
      await trx('ledger_entries').insert(ledgerRows);

      await trx('loans').where({ id }).update({
        status: 'written_off',
        principal_outstanding: 0,
        interest_balance: 0,
        write_off_amount: totalWriteOff,
        write_off_reason: reason.trim(),
        written_off_at: trx.fn.now(),
        updated_at: trx.fn.now()
      });

      await trx('audit_logs').insert({
        actor_id: authUser.id,
        action_type: 'WRITE_OFF_LOAN',
        description: `Wrote off loan ID ${id} as bad debt: LKR ${totalWriteOff.toLocaleString()} (principal: LKR ${principal.toLocaleString()}, interest: LKR ${interest.toLocaleString()}). Reason: ${reason.trim()}.`
      });

      return { totalWriteOff };
    });

    return NextResponse.json({ message: 'Loan written off and posted to ledger.', totalWriteOff: result.totalWriteOff });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Write off loan error:', error);
    if (error.message?.includes('not found') || error.message?.includes('can be written off') || error.message?.includes('no outstanding balance')) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Internal server error while writing off loan.' }, { status: 500 });
  }
}
