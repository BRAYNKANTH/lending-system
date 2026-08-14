import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { runInterestAccruals } from '@/lib/services/interest.js';
import { logError } from '@/lib/logger.js';
import { checkRateLimit } from '@/lib/rateLimit.js';

// Get detailed loan statement
export async function GET(request, { params }) {
  try {
    const { role, id: userId } = await requireAuth(request);
    const { id } = params;

    // Automatically trigger any pending interest accrual in real-time, but
    // only for this one loan — previously this swept every active loan in
    // the system on every single loan-detail page view.
    await runInterestAccruals(id);

    const loan = await db('loans')
      .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
      .leftJoin('users as agents', 'loans.assigned_agent_id', 'agents.id')
      .where('loans.id', id)
      .select('loans.*', 'borrowers.name as borrower_name', 'borrowers.phone as borrower_phone', 'borrowers.email as borrower_email', 'borrowers.gender as borrower_gender', 'agents.name as agent_name')
      .first();

    if (!loan) {
      return NextResponse.json({ message: 'Loan not found.' }, { status: 404 });
    }
    if (role === 'borrower' && loan.borrower_id !== userId) {
      return NextResponse.json({ message: 'Access denied to this loan file.' }, { status: 403 });
    }
    if (role === 'agent' && loan.assigned_agent_id !== userId) {
      return NextResponse.json({ message: 'This loan is not assigned to you.' }, { status: 403 });
    }

    // None of these five depend on each other — run concurrently instead
    // of as five sequential round-trips.
    const [payments, accruals, ledger, guarantors, dailyCollections] = await Promise.all([
      db('transactions')
        .join('users as agents', 'transactions.agent_id', 'agents.id')
        .where({ loan_id: id })
        .select('transactions.*', 'agents.name as agent_name')
        .orderBy('payment_date', 'desc'),
      db('interest_accruals').where({ loan_id: id }).orderBy('created_at', 'desc'),
      db('ledger_entries').where({ loan_id: id }).orderBy('created_at', 'asc'),
      db('guarantors').where({ loan_id: id }).orderBy('created_at', 'asc'),
      db('daily_collections')
        .leftJoin('users as markers', 'daily_collections.marked_by', 'markers.id')
        .where({ loan_id: id })
        .select('daily_collections.*', 'markers.name as marked_by_name')
        .orderBy('collection_date', 'desc')
    ]);

    // `guarantor` (singular, first one) is kept alongside `guarantors` (the
    // full list) for backward compatibility with any code still reading the
    // old single-guarantor shape — loans can now have more than one.
    return NextResponse.json({ loan, payments, accruals, ledger, guarantors, guarantor: guarantors[0] || null, dailyCollections });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Fetch loan details error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Failed to retrieve loan details.' }, { status: 500 });
  }
}

// Edit mutable loan terms — interest rate and assigned agent only.
// Principal/borrower are intentionally never editable: they're the basis of
// every past ledger entry, so changing them after disbursement would
// silently desync the ledger from the loan record. (Admin only)
export async function PATCH(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin']);
    const { id } = params;
    const { interest_rate, assigned_agent_id } = await request.json();

    const loan = await db('loans').where({ id }).first();
    if (!loan) {
      return NextResponse.json({ message: 'Loan not found.' }, { status: 404 });
    }
    if (loan.status === 'fully_paid' || loan.status === 'defaulted') {
      return NextResponse.json({ message: `Cannot edit a loan with status '${loan.status}'.` }, { status: 400 });
    }

    const updates = {};
    const changes = [];

    if (interest_rate !== undefined) {
      const rate = parseFloat(interest_rate);
      if (isNaN(rate) || rate < 0) {
        return NextResponse.json({ message: 'Interest rate must be a non-negative number.' }, { status: 400 });
      }
      updates.interest_rate = rate;
      changes.push(`interest rate ${loan.interest_rate}% -> ${rate}%`);
    }

    if (assigned_agent_id !== undefined) {
      if (assigned_agent_id) {
        const agent = await db('users')
          .where({ id: assigned_agent_id })
          .whereIn('role', ['agent', 'admin'])
          .first();
        if (!agent) {
          return NextResponse.json({ message: 'Assigned agent/admin not found.' }, { status: 404 });
        }
      }
      updates.assigned_agent_id = assigned_agent_id || null;
      changes.push('assigned agent changed');
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'No editable fields supplied (interest_rate, assigned_agent_id).' }, { status: 400 });
    }

    updates.updated_at = db.fn.now();
    await db('loans').where({ id }).update(updates);

    await db('audit_logs').insert({
      actor_id: authUser.id,
      action_type: 'UPDATE_LOAN',
      description: `Edited loan ID ${id}: ${changes.join(', ')}.`
    });

    const updatedLoan = await db('loans').where({ id }).first();
    return NextResponse.json({ message: 'Loan updated successfully.', loan: updatedLoan });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Update loan error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Internal server error while updating loan.' }, { status: 500 });
  }
}

// Permanently deletes a loan (Admin only) — for a mistaken entry or test
// data, NOT a real closed-out account (that's what Write Off is for).
// Requires the admin to re-enter their own password, same idea as a
// destructive-action re-auth prompt elsewhere: being logged in proves who
// you are for browsing, not that you specifically mean to do this one
// irreversible thing right now.
//
// Deliberately does not attempt to delete a loan with any real payment or
// interest-accrual history — transactions.loan_id and
// interest_accruals.loan_id are ON DELETE RESTRICT at the database level
// (see schema.sql / scripts/migrate.js), so Postgres itself would refuse
// the delete anyway; this just checks first to return a clear message
// instead of a raw constraint-violation error. guarantors and
// daily_collections cascade-delete automatically (ON DELETE CASCADE);
// ledger_entries do NOT cascade (ON DELETE SET NULL) so they're deleted
// explicitly below rather than left as orphaned rows with a null loan_id.
export async function DELETE(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin']);
    const { id } = params;
    const { password, reason } = await request.json();

    if (!password) {
      return NextResponse.json({ message: 'Your password is required to confirm this deletion.' }, { status: 400 });
    }
    if (!reason || !reason.trim()) {
      return NextResponse.json({ message: 'A reason is required to delete a loan.' }, { status: 400 });
    }

    // Same per-account limiter shape as login — this endpoint lets someone
    // repeatedly guess the admin's password if left unthrottled.
    const { limited, retryAfterMs } = checkRateLimit(`delete-loan-auth:${authUser.id}`, { windowMs: 15 * 60 * 1000, max: 10 });
    if (limited) {
      return NextResponse.json(
        { message: 'Too many attempts. Please wait 15 minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      );
    }

    const actingUser = await db('users').where({ id: authUser.id }).first();
    const passwordOk = actingUser && await bcrypt.compare(password, actingUser.password_hash);
    if (!passwordOk) {
      return NextResponse.json({ message: 'Incorrect password.' }, { status: 401 });
    }

    const loan = await db('loans')
      .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
      .where('loans.id', id)
      .select('loans.*', 'borrowers.name as borrower_name')
      .first();
    if (!loan) {
      return NextResponse.json({ message: 'Loan not found.' }, { status: 404 });
    }

    const [{ count: txCount }] = await db('transactions').where({ loan_id: id }).count('id as count');
    const [{ count: accrualCount }] = await db('interest_accruals').where({ loan_id: id }).count('id as count');
    if (parseInt(txCount, 10) > 0 || parseInt(accrualCount, 10) > 0) {
      return NextResponse.json({
        message: `This loan has real activity (${txCount} payment${txCount == 1 ? '' : 's'}, ${accrualCount} interest accrual${accrualCount == 1 ? '' : 's'}) and can't be deleted — use Write Off instead if it needs to be closed out.`,
      }, { status: 400 });
    }

    await db.transaction(async (trx) => {
      await trx('ledger_entries').where({ loan_id: id }).del();
      await trx('loans').where({ id }).del(); // guarantors + daily_collections cascade automatically

      await trx('audit_logs').insert({
        actor_id: authUser.id,
        action_type: 'DELETE_LOAN',
        description: `Deleted loan '${loan.reference_number || id}' for borrower '${loan.borrower_name}' (principal LKR ${parseFloat(loan.principal_amount).toLocaleString()}, status was '${loan.status}'). Reason: ${reason.trim()}.`,
      });
    });

    return NextResponse.json({ message: 'Loan permanently deleted.' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Delete loan error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Internal server error while deleting loan.' }, { status: 500 });
  }
}
