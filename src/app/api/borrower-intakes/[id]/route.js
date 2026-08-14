import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { logError } from '@/lib/logger.js';

// Full detail for a single intake, photos included — the list endpoint
// (GET /api/borrower-intakes) strips NIC/photo-proof photos to keep the
// review queue light, same reasoning as stripLoanMedia; this is what
// "Create Loan from This" calls to fetch everything back before
// pre-filling the Give Loan wizard.
export async function GET(request, { params }) {
  try {
    await requireAuth(request, ['admin', 'agent']);
    const { id } = params;
    const intake = await db('borrower_intakes').where({ id }).first();
    if (!intake) {
      return NextResponse.json({ message: 'Borrower intake submission not found.' }, { status: 404 });
    }
    return NextResponse.json(intake);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Fetch borrower intake error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Failed to fetch borrower intake submission.' }, { status: 500 });
  }
}

// Mark a borrower-intake submission as dismissed (not going anywhere — a
// duplicate, a mistake, someone who changed their mind) or converted
// (linked to the real loan it became, via converted_loan_id — set by the
// loan-creation flow itself when a loan is created "from" an intake, not
// called directly from here).
export async function PATCH(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin', 'agent']);
    const { id } = params;
    const { status, notes } = await request.json();

    if (status && !['pending', 'dismissed'].includes(status)) {
      return NextResponse.json({ message: "Status must be 'pending' or 'dismissed' (conversion happens via loan creation, not here)." }, { status: 400 });
    }

    const intake = await db('borrower_intakes').where({ id }).first();
    if (!intake) {
      return NextResponse.json({ message: 'Borrower intake submission not found.' }, { status: 404 });
    }
    if (intake.status === 'converted') {
      return NextResponse.json({ message: 'This submission has already been converted to a loan and can no longer be edited.' }, { status: 400 });
    }

    const updates = { updated_at: db.fn.now() };
    if (status) {
      updates.status = status;
      updates.reviewed_by = authUser.id;
      updates.reviewed_at = db.fn.now();
    }
    if (notes !== undefined) updates.notes = notes?.trim() || null;

    const [updated] = await db('borrower_intakes').where({ id }).update(updates).returning('*');
    return NextResponse.json({ message: 'Updated.', intake: updated });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Update borrower intake error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Failed to update borrower intake submission.' }, { status: 500 });
  }
}
