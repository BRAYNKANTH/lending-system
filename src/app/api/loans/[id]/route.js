import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { runInterestAccruals } from '@/lib/services/interest.js';

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
    const [payments, accruals, ledger, guarantor, dailyCollections] = await Promise.all([
      db('transactions')
        .join('users as agents', 'transactions.agent_id', 'agents.id')
        .where({ loan_id: id })
        .select('transactions.*', 'agents.name as agent_name')
        .orderBy('payment_date', 'desc'),
      db('interest_accruals').where({ loan_id: id }).orderBy('created_at', 'desc'),
      db('ledger_entries').where({ loan_id: id }).orderBy('created_at', 'asc'),
      db('guarantors').where({ loan_id: id }).first(),
      db('daily_collections')
        .leftJoin('users as markers', 'daily_collections.marked_by', 'markers.id')
        .where({ loan_id: id })
        .select('daily_collections.*', 'markers.name as marked_by_name')
        .orderBy('collection_date', 'desc')
    ]);

    return NextResponse.json({ loan, payments, accruals, ledger, guarantor: guarantor || null, dailyCollections });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Fetch loan details error:', error);
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
    console.error('Update loan error:', error);
    return NextResponse.json({ message: 'Internal server error while updating loan.' }, { status: 500 });
  }
}
