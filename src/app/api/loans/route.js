import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { validateImageDataUrl, validateImageDataUrlArray } from '@/lib/services/image.js';
import { notifyLoanCreation, notifyLoanPendingApproval } from '@/lib/services/notification.js';
import { isValidSriLankanNIC, addInterval, getSriLankaTodayRange } from '@/lib/loanSchedule.js';
import { normalizePhone } from '@/lib/phone.js';
import { stripLoanMediaList } from '@/lib/stripMedia.js';
import bcrypt from 'bcryptjs';
import { generateTempPassword } from '@/lib/tempPassword.js';

// How many active/pending loans one guarantor (by NIC) can back at the same
// time — mirrored (same value, not imported — route.js files should only
// export HTTP method handlers) in /api/loans/[id]/guarantor, which enforces
// the same rule when a guarantor is added/edited on an already-created loan.
const MAX_ACTIVE_GUARANTEED_LOANS = 3;

// Create a new loan. Admin-created loans disburse immediately, same as
// always. Agent-created loans go in as 'pending' instead — no cash moves
// and no ledger entries post until an admin reviews and approves it (see
// /api/loans/[id]/approve and /reject). This lets field agents originate
// loans without being able to unilaterally hand out cash.
export async function POST(request) {
  try {
    const authUser = await requireAuth(request, ['admin', 'agent']);
    const isAgentSubmission = authUser.role === 'agent';
    const body = await request.json();
    const {
      borrower_name, borrower_phone, borrower_address, borrower_date_of_birth, principal_amount, interest_rate, interest_type,
      assigned_agent_id, nic_number, nic_photos, photo_proofs, guarantor, guarantors, borrower_profile,
      collection_mode, duration_periods, borrower_email, borrower_gender, source_intake_id, disbursement_date
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
    if (!nic_photos || !Array.isArray(nic_photos) || nic_photos.length === 0) {
      return NextResponse.json({ message: "Borrower's NIC photo (at least 1 photo) is required." }, { status: 400 });
    }
    if (!photo_proofs || !Array.isArray(photo_proofs) || photo_proofs.length === 0) {
      return NextResponse.json({ message: "Borrower's photo proof (at least 1 photo) is required." }, { status: 400 });
    }
    if (!borrower_date_of_birth) {
      return NextResponse.json({ message: "Borrower's date of birth is required." }, { status: 400 });
    }
    const dob = new Date(borrower_date_of_birth);
    if (isNaN(dob.getTime()) || dob > new Date()) {
      return NextResponse.json({ message: "Borrower's date of birth is invalid." }, { status: 400 });
    }

    // Backdated disbursement — lets an admin register a loan that was
    // actually handed out on an earlier date (e.g. catching up on paper
    // records) instead of every loan being forced to start "today". Admin
    // only: an agent's submission goes into 'pending' and its accrual
    // schedule is recomputed from the actual approval moment anyway (see
    // /api/loans/[id]/approve), so a backdated date here would just be
    // discarded — better to ignore it outright than let an agent set a
    // date that silently does nothing.
    let disbursementDateOverride = null;
    if (!isAgentSubmission && disbursement_date) {
      const parsedDisbursement = new Date(disbursement_date);
      if (isNaN(parsedDisbursement.getTime())) {
        return NextResponse.json({ message: 'Invalid disbursement date.' }, { status: 400 });
      }
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      if (parsedDisbursement > endOfToday) {
        return NextResponse.json({ message: 'Disbursement date cannot be in the future.' }, { status: 400 });
      }
      disbursementDateOverride = parsedDisbursement;
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

    const colMode = collection_mode || 'open_ended';
    if (!['open_ended', 'fixed_term'].includes(colMode)) {
      return NextResponse.json({ message: 'Invalid collection mode.' }, { status: 400 });
    }

    let periods = null;
    if (colMode === 'fixed_term') {
      periods = parseInt(duration_periods, 10);
      if (isNaN(periods) || periods <= 0) {
        return NextResponse.json({ message: 'Duration must be a positive integer for fixed term loans.' }, { status: 400 });
      }
    }

    const principal = parseFloat(principal_amount);
    const rate = parseFloat(interest_rate);
    if (isNaN(principal) || principal <= 0) {
      return NextResponse.json({ message: 'Principal amount must be a positive number.' }, { status: 400 });
    }
    if (isNaN(rate) || rate < 0) {
      return NextResponse.json({ message: 'Interest rate must be a non-negative number.' }, { status: 400 });
    }

    // Flat Daily Installment: Daily + Fixed Term loans bundle principal and
    // interest into one flat amount collected every day (starting the
    // disbursement day itself) for the FULL entered duration — which
    // includes one extra collection day per month beyond the nominal
    // 30/60/90 (31 = 1 month, 62 = 2 months, 93 = 3 months, ...). This is
    // how the client's agents actually collect in the field, and is
    // fundamentally different from the interest-only model every other
    // loan type (Weekly, Monthly, and Open-Ended Daily) still uses.
    const isFlatInstallment = interest_type === 'daily' && colMode === 'fixed_term';
    let dailyInstallmentAmount = null;
    let principalPerDay = null;
    let interestPerDay = null;
    let initialInterestBalance = 0;

    if (isFlatInstallment) {
      if (periods % 31 !== 0) {
        return NextResponse.json({ message: 'Daily Fixed Term duration must be a multiple of 31 days — 31 for 1 month, 62 for 2 months, 93 for 3 months, and so on (30/60/90 is the nominal period; the extra day per month is collected too).' }, { status: 400 });
      }
      const numMonths = periods / 31;
      const nominalDays = periods - numMonths; // 30, 60, 90, ...
      const totalInterest = principal * (rate / 100) * numMonths;
      dailyInstallmentAmount = (principal + totalInterest) / nominalDays;
      principalPerDay = principal / periods;
      interestPerDay = dailyInstallmentAmount - principalPerDay;
      initialInterestBalance = interestPerDay * periods;
    }

    // An agent submitting a loan application is always its own collector —
    // whatever the client sent for assigned_agent_id is ignored so an agent
    // can't route a loan they're proposing to someone else's route.
    const effectiveAssignedAgentId = isAgentSubmission ? authUser.id : (assigned_agent_id || null);

    if (effectiveAssignedAgentId && !isAgentSubmission) {
      const agentUser = await db('users')
        .where({ id: effectiveAssignedAgentId })
        .whereIn('role', ['agent', 'admin'])
        .first();
      if (!agentUser) {
        return NextResponse.json({ message: 'Assigned agent/admin not found.' }, { status: 404 });
      }
    }

    // Accepts either the newer `guarantors` array (one form per dependent,
    // as the create-loan wizard now collects) or the older singular
    // `guarantor` object, for backward compatibility with any other caller.
    const guarantorInputs = Array.isArray(guarantors)
      ? guarantors
      : (guarantor && guarantor.full_name && guarantor.full_name.trim() ? [guarantor] : []);

    const guarantorRecords = [];
    for (const g of guarantorInputs) {
      if (!g || !g.full_name || !g.full_name.trim()) continue;
      if (!g.nic_number || !isValidSriLankanNIC(g.nic_number)) {
        return NextResponse.json({ message: `Guarantor '${g.full_name}'s NIC number is required and must be a valid Sri Lankan NIC format.` }, { status: 400 });
      }
      const cleanGuarantorNIC = g.nic_number.trim().toUpperCase();
      // A guarantor can only back up to MAX_ACTIVE_GUARANTEED_LOANS loans at
      // once (active + pending — a pending application is a live commitment
      // too, since it becomes active the moment an admin approves it), so
      // one person's promise-to-pay can't be stretched across an unlimited
      // number of borrowers at the same time.
      const { count: activeGuaranteeCount } = await db('guarantors')
        .join('loans', 'guarantors.loan_id', 'loans.id')
        .where('guarantors.nic_number', cleanGuarantorNIC)
        .whereIn('loans.status', ['active', 'pending'])
        .countDistinct('guarantors.loan_id as count')
        .first();
      if (parseInt(activeGuaranteeCount, 10) >= MAX_ACTIVE_GUARANTEED_LOANS) {
        return NextResponse.json({ message: `Guarantor '${g.full_name}' (NIC ${cleanGuarantorNIC}) is already backing ${activeGuaranteeCount} active/pending loans — the maximum of ${MAX_ACTIVE_GUARANTEED_LOANS} at a time has been reached.` }, { status: 400 });
      }
      if (!g.address || !g.address.trim()) {
        return NextResponse.json({ message: `Guarantor '${g.full_name}'s address is required.` }, { status: 400 });
      }
      if (!g.phone || !g.phone.trim()) {
        return NextResponse.json({ message: `Guarantor '${g.full_name}'s phone number is required.` }, { status: 400 });
      }
      if (!g.nic_photos || !Array.isArray(g.nic_photos) || g.nic_photos.length === 0) {
        return NextResponse.json({ message: `A NIC photo (at least 1) is required for guarantor '${g.full_name}'.` }, { status: 400 });
      }
      const guarantorNicPhotoUrls = validateImageDataUrlArray(g.nic_photos);
      if (!guarantorNicPhotoUrls) {
        return NextResponse.json({ message: `Failed to process the NIC photo(s) for guarantor '${g.full_name}'. Upload 1-4 valid JPEG/PNG/WebP images, each under 4MB.` }, { status: 400 });
      }
      // Photo proof is not a concept for guarantors at all — NIC photo
      // alone identifies them. Not even accepted as an optional input:
      // address_proof_url/photo_proof_urls are always null for a
      // newly-created guarantor (the columns themselves stay on the
      // guarantors table, unused going forward, so any pre-existing
      // guarantor's old photo proof isn't deleted — it just never displays
      // anywhere in the app anymore and nothing new is ever stored there).
      guarantorRecords.push({
        full_name: g.full_name.trim(),
        nic_number: g.nic_number.trim().toUpperCase(),
        gender: g.gender || null,
        ethnicity: null,
        date_of_birth: null,
        address: g.address.trim(),
        phone: g.phone.trim().replace(/\s+/g, ''),
        email: null,
        nic_photo_url: guarantorNicPhotoUrls[0],
        address_proof_url: null,
        nic_photo_urls: JSON.stringify(guarantorNicPhotoUrls),
        photo_proof_urls: null,
        protected_under_debt_act: !!g.protected_under_debt_act,
        has_pending_court_cases: !!g.has_pending_court_cases,
        monthly_income_business: parseFloat(g.monthly_income_business) || 0,
        monthly_income_agriculture: parseFloat(g.monthly_income_agriculture) || 0,
        monthly_income_other: parseFloat(g.monthly_income_other) || 0,
        monthly_expense_food: parseFloat(g.monthly_expense_food) || 0,
        monthly_expense_rent: parseFloat(g.monthly_expense_rent) || 0,
        monthly_expense_other: parseFloat(g.monthly_expense_other) || 0
      });
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

    // NIC photo(s) — up to 4, stored directly as base64 data URLs in the
    // database (Vercel's serverless filesystem can't persist uploaded
    // files). Required for the borrower now (checked above), same as
    // Photo Proof below — both are must-have KYC before a loan disburses.
    const nic_photo_urls = validateImageDataUrlArray(nic_photos);
    if (!nic_photo_urls) {
      return NextResponse.json({ message: 'Failed to process the NIC photo(s). Upload 1-4 valid JPEG/PNG/WebP images, each under 4MB.' }, { status: 400 });
    }

    // Photo proof (e.g. a utility bill or any other ID/photo evidence) —
    // required (checked above), same base64-in-DB storage as the NIC photos.
    const photo_proof_urls = validateImageDataUrlArray(photo_proofs);
    if (!photo_proof_urls) {
      return NextResponse.json({ message: "Failed to process the borrower's photo proof image(s). Upload 1-4 valid JPEG/PNG/WebP images, each under 4MB." }, { status: 400 });
    }

    let cleanEmail = null;
    if (borrower_email && borrower_email.trim()) {
      cleanEmail = borrower_email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return NextResponse.json({ message: 'Invalid email format.' }, { status: 400 });
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

        // Validate email uniqueness
        if (cleanEmail) {
          const existingEmailUser = await db('users').where({ email: cleanEmail }).first();
          if (existingEmailUser && existingEmailUser.id !== borrower.id) {
            return NextResponse.json({ message: 'Email address is already registered to another user.' }, { status: 400 });
          }
        }

        const updateFields = { phone: cleanPhone, name: borrower_name.trim(), updated_at: db.fn.now() };
        if (cleanEmail !== undefined) updateFields.email = cleanEmail;
        if (borrower_gender !== undefined) updateFields.gender = borrower_gender || null;

        await db('users').where({ id: borrower.id }).update(updateFields);
        borrower = { ...borrower, ...updateFields };

        await db('audit_logs').insert({
          actor_id: authUser.id,
          action_type: 'BORROWER_PHONE_UPDATED',
          description: `Matched new loan to existing borrower '${borrower.name}' (NIC: ${cleanNIC}) by NIC — no phone match, but a prior loan under this NIC exists. Updated phone from '${oldPhone}' to '${cleanPhone}'.`
        });
      }
    } else {
      // Validate email uniqueness
      if (cleanEmail) {
        const existingEmailUser = await db('users').where({ email: cleanEmail }).first();
        if (existingEmailUser && existingEmailUser.id !== borrower.id) {
          return NextResponse.json({ message: 'Email address is already registered to another user.' }, { status: 400 });
        }
      }

      const updateFields = { name: borrower_name.trim(), updated_at: db.fn.now() };
      if (cleanEmail !== undefined) updateFields.email = cleanEmail;
      if (borrower_gender !== undefined) updateFields.gender = borrower_gender || null;

      await db('users').where({ id: borrower.id }).update(updateFields);
      borrower = { ...borrower, ...updateFields };
    }

    if (!borrower) {
      // Validate email uniqueness
      if (cleanEmail) {
        const existingEmailUser = await db('users').where({ email: cleanEmail }).first();
        if (existingEmailUser) {
          return NextResponse.json({ message: 'Email address is already registered to another user.' }, { status: 400 });
        }
      }

      const [newBorrowerId] = await db('users').insert({
        name: borrower_name.trim(),
        phone: cleanPhone,
        email: cleanEmail,
        gender: borrower_gender || null,
        password_hash: 'NO_LOGIN_ACCESS',
        role: 'borrower',
        is_active: true,
        must_change_password: false
      }).returning('id');

      const bId = newBorrowerId.id || newBorrowerId;
      borrower = { id: bId, name: borrower_name.trim(), phone: cleanPhone, email: cleanEmail, gender: borrower_gender || null };

      await db('audit_logs').insert({
        actor_id: authUser.id,
        action_type: 'USER_REGISTRATION',
        description: `Automatically registered new borrower '${borrower.name}' with phone '${borrower.phone}' during loan disbursement.`
      });
    }

    const borrower_id = borrower.id;

    const creationDate = disbursementDateOverride || new Date();
    // For a pending application this is a placeholder — approval recomputes
    // it from the actual approval moment, since interest shouldn't accrue
    // while the loan is just sitting in the review queue.
    const nextAccrualDate = addInterval(creationDate, interest_type);
    let calculatedMaturityDate = null;
    if (colMode === 'fixed_term') {
      // Flat installment collection starts ON the disbursement day (day 0
      // is the first of the `periods` collection days), so the last
      // collection day is `periods - 1` days after creation — one earlier
      // than every other fixed-term loan, where collection starts the day
      // after disbursement.
      calculatedMaturityDate = isFlatInstallment
        ? addInterval(creationDate, interest_type, periods - 1)
        : addInterval(creationDate, interest_type, periods);
    }

    const initialStatus = isAgentSubmission ? 'pending' : 'active';

    const orgSettings = await db('org_settings').first();
    const refPrefix = orgSettings?.reference_prefix || 'LN';

    // Reference numbers are generated from MAX(existing numeric suffix) + 1,
    // not COUNT(*) + 1 — a plain row count silently desyncs from the actual
    // highest number ever issued the moment any single reference number
    // goes missing anywhere in history (this is exactly what caused a real
    // production 500: the earliest loan's number was gone — deleted or
    // never issued — so COUNT(*)+1 kept generating a number that already
    // belonged to a later loan, hitting the unique constraint on every
    // single new loan). MAX-based generation is correct regardless of any
    // such gap. The retry loop below is a second line of defense against a
    // genuine concurrent-request race (two requests computing the same MAX
    // in the same instant) — on a reference_number collision specifically,
    // it just recomputes and tries again, a few times before giving up.
    const generateNextReferenceNumber = async (trx) => {
      const { rows } = await trx.raw(
        `SELECT MAX(CAST(SUBSTRING(reference_number FROM '[0-9]+$') AS INTEGER)) as max_num
         FROM loans WHERE reference_number LIKE ?`,
        [`${refPrefix}-%`]
      );
      const nextSequence = (parseInt(rows[0]?.max_num, 10) || 0) + 1;
      return `${refPrefix}-${String(nextSequence).padStart(3, '0')}`;
    };

    const MAX_REFERENCE_NUMBER_ATTEMPTS = 5;
    let loanResult = null;
    for (let attempt = 1; attempt <= MAX_REFERENCE_NUMBER_ATTEMPTS; attempt++) {
      try {
        loanResult = await db.transaction(async (trx) => {
          const refNumber = await generateNextReferenceNumber(trx);

          const [newLoan] = await trx('loans').insert({
            borrower_id,
            lender_id: authUser.id,
            assigned_agent_id: effectiveAssignedAgentId,
            principal_amount: principal,
            interest_rate: rate,
            interest_type,
            principal_outstanding: principal,
            interest_balance: isFlatInstallment ? initialInterestBalance : 0,
            is_flat_installment: isFlatInstallment,
            daily_installment_amount: dailyInstallmentAmount,
            principal_per_day: principalPerDay,
            interest_per_day: interestPerDay,
            status: initialStatus,
            created_at: creationDate,
            last_accrual_date: creationDate,
            next_accrual_date: nextAccrualDate,
            nic_number: cleanNIC,
            nic_photo_url: nic_photo_urls[0],
            address_proof_url: photo_proof_urls[0],
            nic_photo_urls: JSON.stringify(nic_photo_urls),
            photo_proof_urls: JSON.stringify(photo_proof_urls),
            date_of_birth: borrower_date_of_birth,
            borrower_address: borrower_address.trim(),
            collection_mode: colMode,
            duration_periods: periods,
            maturity_date: calculatedMaturityDate,
            reference_number: refNumber,
            ...(borrowerProfileRecord || {})
          }).returning('*');

          const loanId = newLoan.id || newLoan;

          // A pending application hasn't actually disbursed anything yet —
          // no cash has moved, so no ledger entries post until an admin
          // approves it (see /api/loans/[id]/approve).
          if (initialStatus === 'active') {
            // Backdated (disbursementDateOverride) alongside the loan
            // itself, so ledger/trial-balance reports for the actual
            // disbursement date reflect this cash outflow instead of it
            // showing up under today's date in the report a backdated
            // registration is trying to avoid.
            await trx('ledger_entries').insert([
              { loan_id: loanId, account: 'loan_receivable_principal', type: 'debit', amount: principal, created_at: creationDate },
              { loan_id: loanId, account: 'cash_office', type: 'credit', amount: principal, created_at: creationDate }
            ]);
          }

          if (guarantorRecords.length > 0) {
            await trx('guarantors').insert(guarantorRecords.map((g) => ({ loan_id: loanId, ...g })));
          }

          const guarantorNames = guarantorRecords.map((g) => g.full_name);
          await trx('audit_logs').insert({
            actor_id: authUser.id,
            action_type: isAgentSubmission ? 'SUBMIT_LOAN_APPLICATION' : 'CREATE_LOAN',
            description: `${isAgentSubmission ? 'Submitted for approval: a' : 'Created'} new loan of LKR ${principal.toLocaleString()} (NIC: ${cleanNIC}, Rate: ${rate}%, Frequency: ${interest_type})${guarantorNames.length > 0 ? ` with guarantor(s) '${guarantorNames.join("', '")}'` : ''} for Borrower ID ${borrower_id}.`
          });

          return newLoan;
        });
        break;
      } catch (err) {
        const isRefCollision = err.code === '23505' && err.constraint === 'loans_reference_number_unique';
        if (!isRefCollision || attempt === MAX_REFERENCE_NUMBER_ATTEMPTS) {
          throw err;
        }
        // Reference number collided — loop again with a freshly computed one.
      }
    }

    if (isAgentSubmission) {
      const admins = await db('users').where({ role: 'admin', is_active: true });
      Promise.all(admins.map((admin) =>
        notifyLoanPendingApproval({ admin, borrower, principal, submittedByName: authUser.name })
      )).catch((err) => console.error('Failed to dispatch notification:', err));
    } else {
      notifyLoanCreation({
        borrower,
        principal,
        interestType: interest_type,
        rate,
        isFlatInstallment,
        dailyInstallmentAmount,
        durationPeriods: periods
      }).catch((err) => console.error('Failed to dispatch notification:', err));
    }

    // If this loan was created from a borrower-intake submission (see
    // /apply and /api/borrower-intakes), close the loop — mark it
    // converted and link the loan it became, so it drops out of the
    // pending review queue and the connection is traceable later.
    if (source_intake_id) {
      await db('borrower_intakes')
        .where({ id: source_intake_id, status: 'pending' })
        .update({
          status: 'converted',
          converted_loan_id: loanResult.id,
          reviewed_by: authUser.id,
          reviewed_at: db.fn.now(),
          updated_at: db.fn.now()
        })
        .catch((err) => console.error('Failed to mark borrower intake as converted:', err));
    }

    return NextResponse.json({
      message: isAgentSubmission ? 'Loan application submitted for admin approval.' : 'Loan created successfully.',
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

    // Whether this loan already had a payment recorded today (Sri Lanka
    // wall-clock day) — backs the Remaining/Done split on the Record
    // Payment screen, so an agent partway through a collection round can
    // see at a glance who's left rather than re-scanning the whole list.
    const { start: todayStart, end: todayEnd } = getSriLankaTodayRange();

    let query = db('loans')
      .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
      .leftJoin('users as agents', 'loans.assigned_agent_id', 'agents.id')
      .select(
        'loans.*',
        'borrowers.name as borrower_name',
        'borrowers.phone as borrower_phone',
        'borrowers.email as borrower_email',
        'borrowers.gender as borrower_gender',
        'agents.name as agent_name',
        db.raw(
          `EXISTS (
            SELECT 1 FROM transactions
            WHERE transactions.loan_id = loans.id
              AND transactions.payment_date >= ?
              AND transactions.payment_date < ?
          ) as paid_today`,
          [todayStart, todayEnd]
        ),
        // Total actually collected on this loan to date (all payments ever
        // recorded against it) — backs the Loan Directory's "Total
        // Collected" summary figure. Deliberately the real cash collected,
        // not derived from principal_outstanding/interest_balance, since
        // interest keeps accruing over time independent of what's been paid.
        db.raw(`COALESCE((
          SELECT SUM(transactions.amount) FROM transactions WHERE transactions.loan_id = loans.id
        ), 0) as total_collected`)
      );

    if (role === 'agent') {
      query = query.where('loans.assigned_agent_id', id);
    } else if (role === 'borrower') {
      query = query.where('loans.borrower_id', id);
    }

    if (status) query = query.where('loans.status', status);
    if (borrowerId && role === 'admin') query = query.where('loans.borrower_id', borrowerId);

    const loans = await query.orderBy('loans.created_at', 'desc');
    return NextResponse.json(stripLoanMediaList(loans));
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Fetch loans error:', error);
    return NextResponse.json({ message: 'Failed to fetch loans.' }, { status: 500 });
  }
}
