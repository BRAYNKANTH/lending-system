import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { validateImageDataUrl } from '@/lib/services/image.js';
import { notifyLoanCreation } from '@/lib/services/notification.js';
import { isValidSriLankanNIC, addInterval } from '@/lib/loanSchedule.js';
import { normalizePhone } from '@/lib/phone.js';

// Create a new loan (Admin only)
export async function POST(request) {
  try {
    const authUser = await requireAuth(request, ['admin']);
    const body = await request.json();
    const {
      borrower_name, borrower_phone, borrower_address, principal_amount, interest_rate, interest_type,
      assigned_agent_id, nic_number, nic_photo, guarantor, borrower_profile
    } = body;

    if (!borrower_name || !borrower_phone || !principal_amount || !interest_rate || !interest_type) {
      return NextResponse.json({ message: 'Borrower name, phone number, principal amount, interest rate, and interest type are required.' }, { status: 400 });
    }
    if (!nic_number) {
      return NextResponse.json({ message: 'NIC number is required for loan disbursement.' }, { status: 400 });
    }
    if (!borrower_address || !borrower_address.trim()) {
      return NextResponse.json({ message: "Borrower's address is required." }, { status: 400 });
    }
    if (!borrower_profile) {
      return NextResponse.json({ message: 'Borrower profile details (loan purpose, dependents, monthly income) are required.' }, { status: 400 });
    }
    if (!borrower_profile.loan_purpose || !borrower_profile.loan_purpose.trim()) {
      return NextResponse.json({ message: 'Purpose of loan is required.' }, { status: 400 });
    }
    if (borrower_profile.dependents_count === undefined || borrower_profile.dependents_count === '' || borrower_profile.dependents_count === null) {
      return NextResponse.json({ message: 'Number of dependents is required.' }, { status: 400 });
    }
    if (borrower_profile.monthly_income === undefined || borrower_profile.monthly_income === '' || borrower_profile.monthly_income === null) {
      return NextResponse.json({ message: 'Monthly income is required.' }, { status: 400 });
    }

    const cleanNIC = nic_number.trim().toUpperCase();
    if (!isValidSriLankanNIC(cleanNIC)) {
      return NextResponse.json({ message: 'Invalid Sri Lankan NIC number format. Use 9 digits with V/X (e.g. 123456789V) or 12 digits (e.g. 199012345678).' }, { status: 400 });
    }
    if (!['daily', 'weekly', 'monthly'].includes(interest_type)) {
      return NextResponse.json({ message: 'Invalid interest type. Use daily, weekly, or monthly.' }, { status: 400 });
    }

    const principal = parseFloat(principal_amount);
    const rate = parseFloat(interest_rate);
    if (isNaN(principal) || principal <= 0) {
      return NextResponse.json({ message: 'Principal amount must be a positive number.' }, { status: 400 });
    }
    if (isNaN(rate) || rate < 0) {
      return NextResponse.json({ message: 'Interest rate must be a non-negative number.' }, { status: 400 });
    }

    let guarantorRecord = null;
    if (guarantor && guarantor.full_name && guarantor.full_name.trim()) {
      if (!guarantor.nic_number || !isValidSriLankanNIC(guarantor.nic_number)) {
        return NextResponse.json({ message: "Guarantor's NIC number is required and must be a valid Sri Lankan NIC format." }, { status: 400 });
      }
      if (!guarantor.address || !guarantor.address.trim()) {
        return NextResponse.json({ message: "Guarantor's address is required." }, { status: 400 });
      }
      if (!guarantor.phone || !guarantor.phone.trim()) {
        return NextResponse.json({ message: "Guarantor's phone number is required." }, { status: 400 });
      }
      guarantorRecord = {
        full_name: guarantor.full_name.trim(),
        nic_number: guarantor.nic_number.trim().toUpperCase(),
        gender: guarantor.gender || null,
        ethnicity: guarantor.ethnicity || null,
        date_of_birth: guarantor.date_of_birth || null,
        address: guarantor.address.trim(),
        phone: guarantor.phone.trim().replace(/\s+/g, ''),
        email: guarantor.email || null,
        protected_under_debt_act: !!guarantor.protected_under_debt_act,
        has_pending_court_cases: !!guarantor.has_pending_court_cases,
        monthly_income_business: parseFloat(guarantor.monthly_income_business) || 0,
        monthly_income_agriculture: parseFloat(guarantor.monthly_income_agriculture) || 0,
        monthly_income_other: parseFloat(guarantor.monthly_income_other) || 0,
        monthly_expense_food: parseFloat(guarantor.monthly_expense_food) || 0,
        monthly_expense_rent: parseFloat(guarantor.monthly_expense_rent) || 0,
        monthly_expense_other: parseFloat(guarantor.monthly_expense_other) || 0
      };
    }

    // Borrower profile snapshot (optional) — mirrors the STN applicant
    // personal-info form; a per-loan record like the guarantor, since these
    // details (income, dependents) can shift loan to loan.
    let borrowerProfileRecord = null;
    if (borrower_profile) {
      borrowerProfileRecord = {
        loan_purpose: borrower_profile.loan_purpose?.trim() || null,
        dependents_count: borrower_profile.dependents_count !== undefined && borrower_profile.dependents_count !== ''
          ? parseInt(borrower_profile.dependents_count, 10) : null,
        monthly_income: borrower_profile.monthly_income !== undefined && borrower_profile.monthly_income !== ''
          ? parseFloat(borrower_profile.monthly_income) : null,
        spouse_name: borrower_profile.spouse_name?.trim() || null,
        spouse_nic: borrower_profile.spouse_nic?.trim().toUpperCase() || null,
        spouse_occupation: borrower_profile.spouse_occupation?.trim() || null
      };
    }

    // NIC photo — stored directly as a base64 data URL in the database
    // (Vercel's serverless filesystem can't persist uploaded files).
    let nic_photo_url = null;
    if (nic_photo) {
      nic_photo_url = validateImageDataUrl(nic_photo);
      if (!nic_photo_url) {
        return NextResponse.json({ message: 'Failed to process the NIC photo image. Please upload a valid JPEG/PNG/WebP under 4MB.' }, { status: 400 });
      }
    }

    const cleanPhone = borrower_phone.trim().replace(/\s+/g, '');

    let borrower = await db('users')
      .where({ role: 'borrower' })
      .whereRaw('phone LIKE ?', [`%${normalizePhone(cleanPhone)}`])
      .first();

    // No phone match — before creating a new borrower record, check whether
    // this NIC already belongs to someone in the system (a past loan). A
    // phone number changing is common; without this, the same real person
    // ends up as two disconnected borrower records with split loan history.
    if (!borrower) {
      const priorLoanForNIC = await db('loans')
        .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
        .where('loans.nic_number', cleanNIC)
        .andWhere('borrowers.role', 'borrower')
        .select('borrowers.*')
        .first();

      if (priorLoanForNIC) {
        borrower = priorLoanForNIC;
        const oldPhone = borrower.phone;
        await db('users').where({ id: borrower.id }).update({ phone: cleanPhone, name: borrower_name.trim(), updated_at: db.fn.now() });
        borrower = { ...borrower, phone: cleanPhone, name: borrower_name.trim() };

        await db('audit_logs').insert({
          actor_id: authUser.id,
          action_type: 'BORROWER_PHONE_UPDATED',
          description: `Matched new loan to existing borrower '${borrower.name}' (NIC: ${cleanNIC}) by NIC — no phone match, but a prior loan under this NIC exists. Updated phone from '${oldPhone}' to '${cleanPhone}'.`
        });
      }
    }

    if (!borrower) {
      // Borrowers are records, not accounts — they never log in, so there's
      // no real password to issue. 'NO_LOGIN_ACCESS' is a deliberately
      // invalid bcrypt hash that bcrypt.compare() always rejects.
      const [newBorrowerId] = await db('users').insert({
        name: borrower_name.trim(),
        phone: cleanPhone,
        password_hash: 'NO_LOGIN_ACCESS',
        role: 'borrower',
        is_active: true,
        must_change_password: false
      }).returning('id');

      const bId = newBorrowerId.id || newBorrowerId;
      borrower = { id: bId, name: borrower_name.trim(), phone: cleanPhone };

      await db('audit_logs').insert({
        actor_id: authUser.id,
        action_type: 'USER_REGISTRATION',
        description: `Automatically registered new borrower '${borrower.name}' with phone '${borrower.phone}' during loan disbursement.`
      });
    }

    const borrower_id = borrower.id;

    if (assigned_agent_id) {
      const agent = await db('users').where({ id: assigned_agent_id, role: 'agent' }).first();
      if (!agent) {
        return NextResponse.json({ message: 'Assigned agent not found.' }, { status: 404 });
      }
    }

    const creationDate = new Date();
    const nextAccrualDate = addInterval(creationDate, interest_type);

    const loanResult = await db.transaction(async (trx) => {
      const [newLoan] = await trx('loans').insert({
        borrower_id,
        lender_id: authUser.id,
        assigned_agent_id: assigned_agent_id || null,
        principal_amount: principal,
        interest_rate: rate,
        interest_type,
        principal_outstanding: principal,
        interest_balance: 0,
        status: 'active',
        next_accrual_date: nextAccrualDate,
        nic_number: cleanNIC,
        nic_photo_url,
        borrower_address: borrower_address.trim(),
        ...(borrowerProfileRecord || {})
      }).returning('*');

      const loanId = newLoan.id || newLoan;

      await trx('ledger_entries').insert([
        { loan_id: loanId, account: 'loan_receivable', type: 'debit', amount: principal },
        { loan_id: loanId, account: 'cash_office', type: 'credit', amount: principal }
      ]);

      if (guarantorRecord) {
        await trx('guarantors').insert({ loan_id: loanId, ...guarantorRecord });
      }

      await trx('audit_logs').insert({
        actor_id: authUser.id,
        action_type: 'CREATE_LOAN',
        description: `Created new loan of LKR ${principal.toLocaleString()} (NIC: ${cleanNIC}, Rate: ${rate}%, Frequency: ${interest_type})${guarantorRecord ? ` with guarantor '${guarantorRecord.full_name}'` : ''} for Borrower ID ${borrower_id}.`
      });

      return newLoan;
    });

    notifyLoanCreation({ borrower, principal, interestType: interest_type })
      .catch((err) => console.error('Failed to dispatch notification:', err));

    return NextResponse.json({
      message: 'Loan created successfully.',
      loan: loanResult
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Loan creation error:', error);
    return NextResponse.json({ message: 'Internal server error while creating loan.' }, { status: 500 });
  }
}

// Get all loans (Filtered by user role)
export async function GET(request) {
  try {
    const { role, id } = await requireAuth(request);
    const status = request.nextUrl.searchParams.get('status');
    const borrowerId = request.nextUrl.searchParams.get('borrowerId');

    let query = db('loans')
      .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
      .leftJoin('users as agents', 'loans.assigned_agent_id', 'agents.id')
      .select(
        'loans.*',
        'borrowers.name as borrower_name',
        'borrowers.phone as borrower_phone',
        'borrowers.email as borrower_email',
        'agents.name as agent_name'
      );

    if (role === 'agent') {
      query = query.where('loans.assigned_agent_id', id);
    } else if (role === 'borrower') {
      query = query.where('loans.borrower_id', id);
    }

    if (status) query = query.where('loans.status', status);
    if (borrowerId && role === 'admin') query = query.where('loans.borrower_id', borrowerId);

    const loans = await query.orderBy('loans.created_at', 'desc');
    return NextResponse.json(loans);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Fetch loans error:', error);
    return NextResponse.json({ message: 'Failed to fetch loans.' }, { status: 500 });
  }
}
