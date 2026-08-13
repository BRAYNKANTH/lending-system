import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { isValidSriLankanNIC } from '@/lib/loanSchedule.js';

// Mirrors the same constant in /api/loans/route.js — see the comment there.
const MAX_ACTIVE_GUARANTEED_LOANS = 3;

// Add or edit the guarantor on an existing loan (Admin only). Previously a
// guarantor could only be recorded at the moment a loan was created — there
// was no way to add one afterward (e.g. it was skipped at issuance but is
// needed later) or to correct a mistake in their details.
export async function PUT(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin']);
    const { id: loanId } = params;
    const guarantor = await request.json();

    const loan = await db('loans').where({ id: loanId }).first();
    if (!loan) {
      return NextResponse.json({ message: 'Loan not found.' }, { status: 404 });
    }

    if (!guarantor.full_name || !guarantor.full_name.trim()) {
      return NextResponse.json({ message: "Guarantor's full name is required." }, { status: 400 });
    }
    if (!guarantor.nic_number || !isValidSriLankanNIC(guarantor.nic_number)) {
      return NextResponse.json({ message: "Guarantor's NIC number is required and must be a valid Sri Lankan NIC format." }, { status: 400 });
    }
    const cleanGuarantorNIC = guarantor.nic_number.trim().toUpperCase();

    // Same cap as at loan-creation time — excludes this loan's own existing
    // guarantor row (if any) so re-saving an unchanged guarantor, or fixing
    // a typo in their details, doesn't get blocked by counting itself.
    const { count: activeGuaranteeCount } = await db('guarantors')
      .join('loans', 'guarantors.loan_id', 'loans.id')
      .where('guarantors.nic_number', cleanGuarantorNIC)
      .whereNot('guarantors.loan_id', loanId)
      .whereIn('loans.status', ['active', 'pending'])
      .countDistinct('guarantors.loan_id as count')
      .first();
    if (parseInt(activeGuaranteeCount, 10) >= MAX_ACTIVE_GUARANTEED_LOANS) {
      return NextResponse.json({ message: `Guarantor '${guarantor.full_name}' (NIC ${cleanGuarantorNIC}) is already backing ${activeGuaranteeCount} other active/pending loans — the maximum of ${MAX_ACTIVE_GUARANTEED_LOANS} at a time has been reached.` }, { status: 400 });
    }
    if (!guarantor.address || !guarantor.address.trim()) {
      return NextResponse.json({ message: "Guarantor's address is required." }, { status: 400 });
    }
    if (!guarantor.phone || !guarantor.phone.trim()) {
      return NextResponse.json({ message: "Guarantor's phone number is required." }, { status: 400 });
    }

    const guarantorRecord = {
      loan_id: loanId,
      full_name: guarantor.full_name.trim(),
      nic_number: guarantor.nic_number.trim().toUpperCase(),
      gender: guarantor.gender || null,
      ethnicity: null,
      date_of_birth: null,
      address: guarantor.address.trim(),
      phone: guarantor.phone.trim().replace(/\s+/g, ''),
      email: null,
      protected_under_debt_act: !!guarantor.protected_under_debt_act,
      has_pending_court_cases: !!guarantor.has_pending_court_cases,
      monthly_income_business: parseFloat(guarantor.monthly_income_business) || 0,
      monthly_income_agriculture: parseFloat(guarantor.monthly_income_agriculture) || 0,
      monthly_income_other: parseFloat(guarantor.monthly_income_other) || 0,
      monthly_expense_food: parseFloat(guarantor.monthly_expense_food) || 0,
      monthly_expense_rent: parseFloat(guarantor.monthly_expense_rent) || 0,
      monthly_expense_other: parseFloat(guarantor.monthly_expense_other) || 0
    };

    const existing = await db('guarantors').where({ loan_id: loanId }).first();
    let saved;
    if (existing) {
      [saved] = await db('guarantors').where({ id: existing.id }).update(guarantorRecord).returning('*');
    } else {
      [saved] = await db('guarantors').insert(guarantorRecord).returning('*');
    }

    await db('audit_logs').insert({
      actor_id: authUser.id,
      action_type: existing ? 'UPDATE_GUARANTOR' : 'ADD_GUARANTOR',
      description: `${existing ? 'Updated' : 'Added'} guarantor '${guarantorRecord.full_name}' on loan ID ${loanId}.`
    });

    return NextResponse.json({ message: `Guarantor ${existing ? 'updated' : 'added'} successfully.`, guarantor: saved });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Upsert guarantor error:', error);
    return NextResponse.json({ message: 'Internal server error while saving guarantor.' }, { status: 500 });
  }
}

// Remove the guarantor from a loan (Admin only) — e.g. it was added by mistake.
export async function DELETE(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin']);
    const { id: loanId } = params;

    const existing = await db('guarantors').where({ loan_id: loanId }).first();
    if (!existing) {
      return NextResponse.json({ message: 'This loan has no guarantor on file.' }, { status: 404 });
    }

    await db('guarantors').where({ id: existing.id }).delete();

    await db('audit_logs').insert({
      actor_id: authUser.id,
      action_type: 'REMOVE_GUARANTOR',
      description: `Removed guarantor '${existing.full_name}' from loan ID ${loanId}.`
    });

    return NextResponse.json({ message: 'Guarantor removed.' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Delete guarantor error:', error);
    return NextResponse.json({ message: 'Internal server error while removing guarantor.' }, { status: 500 });
  }
}
