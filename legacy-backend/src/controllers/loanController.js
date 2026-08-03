import db from '../config/db.js';
import { notifyLoanCreation } from '../services/notification.js';
import { saveBase64Image } from '../services/imageService.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Generates a random human-typeable temporary password (e.g. "K7F2-93QZ")
function generateTempPassword() {
  return crypto.randomBytes(4).toString('hex').toUpperCase().match(/.{1,4}/g).join('-');
}

function isValidSriLankanNIC(nic) {
  const cleaned = nic.trim().toUpperCase();
  return /^[0-9]{9}[VX]$/.test(cleaned) || /^[0-9]{12}$/.test(cleaned);
}

function addInterval(date, interestType, count = 1) {
  const result = new Date(date);
  const days = interestType === 'daily' ? 1 : interestType === 'weekly' ? 7 : 30;
  result.setDate(result.getDate() + days * count);
  return result;
}

// Builds a fixed repayment schedule (passbook-style): equal installments
// covering principal + flat-rate interest over the given number of periods.
// This is purely a repayment/tracking overlay — it does not change how or
// when interest is recognized in the ledger; the existing accrual engine
// keeps running independently and, by construction, uses the same
// principal*(rate/100) per-period math, so the two stay in step.
function buildInstallmentSchedule({ principal, rate, interestType, numInstallments, startDate }) {
  const totalInterest = principal * (rate / 100) * numInstallments;
  const totalRepayable = principal + totalInterest;
  const rawInstallmentAmount = Math.round((totalRepayable / numInstallments) * 100) / 100;

  const installments = [];
  let allocatedSoFar = 0;
  for (let i = 1; i <= numInstallments; i++) {
    const isLast = i === numInstallments;
    const expectedAmount = isLast
      ? Math.round((totalRepayable - allocatedSoFar) * 100) / 100
      : rawInstallmentAmount;
    allocatedSoFar += expectedAmount;
    installments.push({
      installment_number: i,
      due_date: addInterval(startDate, interestType, i),
      expected_amount: expectedAmount
    });
  }

  return { totalInterest, totalRepayable, installmentAmount: rawInstallmentAmount, installments };
}

// Create a new loan (Admin only)
export async function createLoan(req, res) {
  try {
    const { borrower_name, borrower_phone, principal_amount, interest_rate, interest_type, num_installments, assigned_agent_id, nic_number, nic_photo, guarantor } = req.body;

    if (!borrower_name || !borrower_phone || !principal_amount || !interest_rate || !interest_type) {
      return res.status(400).json({ message: 'Borrower name, phone number, principal amount, interest rate, and interest type are required.' });
    }

    if (!nic_number) {
      return res.status(400).json({ message: 'NIC number is required for loan disbursement.' });
    }

    // Sri Lankan NIC validation
    const cleanNIC = nic_number.trim().toUpperCase();
    const isOldNIC = /^[0-9]{9}[VX]$/.test(cleanNIC);
    const isNewNIC = /^[0-9]{12}$/.test(cleanNIC);
    if (!isOldNIC && !isNewNIC) {
      return res.status(400).json({ message: 'Invalid Sri Lankan NIC number format. Use 9 digits with V/X (e.g. 123456789V) or 12 digits (e.g. 199012345678).' });
    }

    if (!['daily', 'weekly', 'monthly'].includes(interest_type)) {
      return res.status(400).json({ message: 'Invalid interest type. Use daily, weekly, or monthly.' });
    }

    const principal = parseFloat(principal_amount);
    const rate = parseFloat(interest_rate);

    if (isNaN(principal) || principal <= 0) {
      return res.status(400).json({ message: 'Principal amount must be a positive number.' });
    }

    if (isNaN(rate) || rate < 0) {
      return res.status(400).json({ message: 'Interest rate must be a non-negative number.' });
    }

    // Installment schedule (optional — mirrors the physical repayment
    // passbook; a loan can still be created without one for open-ended
    // collection, matching the legacy behavior).
    let numInstallments = null;
    if (num_installments !== undefined && num_installments !== null && num_installments !== '') {
      numInstallments = parseInt(num_installments, 10);
      if (isNaN(numInstallments) || numInstallments <= 0) {
        return res.status(400).json({ message: 'Number of installments must be a positive whole number.' });
      }
    }

    // Guarantor (optional) — mirrors the STN guarantor personal-info form
    let guarantorRecord = null;
    if (guarantor && guarantor.full_name && guarantor.full_name.trim()) {
      if (!guarantor.nic_number || !isValidSriLankanNIC(guarantor.nic_number)) {
        return res.status(400).json({ message: "Guarantor's NIC number is required and must be a valid Sri Lankan NIC format." });
      }
      if (!guarantor.address || !guarantor.address.trim()) {
        return res.status(400).json({ message: "Guarantor's address is required." });
      }
      if (!guarantor.phone || !guarantor.phone.trim()) {
        return res.status(400).json({ message: "Guarantor's phone number is required." });
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

    // Save NIC Photo to disk if provided
    let nic_photo_url = null;
    if (nic_photo) {
      nic_photo_url = saveBase64Image(nic_photo, 'nic');
      if (!nic_photo_url) {
        return res.status(400).json({ message: 'Failed to process or save the NIC photo image. Please upload a valid image file.' });
      }
    }

    // Normalize phone number (remove spaces)
    const cleanPhone = borrower_phone.trim().replace(/\s+/g, '');

    // 1. Dynamic Check/Register Borrower
    let borrower = await db('users').where({ phone: cleanPhone, role: 'borrower' }).first();
    let borrowerTempPassword = null;

    if (!borrower) {
      borrowerTempPassword = generateTempPassword();
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(borrowerTempPassword, salt);

      const [newBorrowerId] = await db('users').insert({
        name: borrower_name.trim(),
        email: `${cleanPhone}@lend.com`, // Auto-generated email to satisfy database uniqueness
        phone: cleanPhone,
        password_hash: passwordHash,
        role: 'borrower',
        is_active: true,
        must_change_password: true
      }).returning('id');

      const bId = newBorrowerId.id || newBorrowerId;
      borrower = {
        id: bId,
        name: borrower_name.trim(),
        phone: cleanPhone
      };

      // Audit log borrower registration
      await db('audit_logs').insert({
        actor_id: req.user.id,
        action_type: 'USER_REGISTRATION',
        description: `Automatically registered new borrower '${borrower.name}' with phone '${borrower.phone}' during loan disbursement.`
      });
    }

    const borrower_id = borrower.id;

    // Verify agent exists (if provided)
    if (assigned_agent_id) {
      const agent = await db('users').where({ id: assigned_agent_id, role: 'agent' }).first();
      if (!agent) {
        return res.status(404).json({ message: 'Assigned agent not found.' });
      }
    }

    // Calculate initial next accrual date
    const creationDate = new Date();
    const nextAccrualDate = addInterval(creationDate, interest_type);

    // Precompute the installment schedule (if requested) — needed before the
    // transaction since the loan row itself stores the schedule totals.
    let schedule = null;
    if (numInstallments) {
      schedule = buildInstallmentSchedule({
        principal,
        rate,
        interestType: interest_type,
        numInstallments,
        startDate: creationDate
      });
    }

    // Run creation inside database transaction
    const loanResult = await db.transaction(async (trx) => {
      // 1. Insert Loan
      const [newLoan] = await trx('loans').insert({
        borrower_id,
        lender_id: req.user.id, // Admin creating the loan
        assigned_agent_id: assigned_agent_id || null,
        principal_amount: principal,
        interest_rate: rate,
        interest_type,
        current_balance: principal,
        status: 'active',
        next_accrual_date: nextAccrualDate,
        nic_number: cleanNIC,
        nic_photo_url,
        num_installments: numInstallments,
        installment_amount: schedule ? schedule.installmentAmount : null,
        total_repayable: schedule ? schedule.totalRepayable : null
      }).returning('*');

      const loanId = newLoan.id || newLoan;

      // 2. Ledger double-entry: principal is funded out of office cash.
      // Debit loan_receivable (Asset increases) / Credit cash_office (Asset decreases)
      await trx('ledger_entries').insert([
        { loan_id: loanId, account: 'loan_receivable', type: 'debit', amount: principal },
        { loan_id: loanId, account: 'cash_office', type: 'credit', amount: principal }
      ]);

      // 3. Insert repayment schedule / passbook rows, if requested
      if (schedule) {
        await trx('installments').insert(
          schedule.installments.map((inst) => ({ loan_id: loanId, ...inst }))
        );
      }

      // 4. Insert guarantor record, if provided
      if (guarantorRecord) {
        await trx('guarantors').insert({ loan_id: loanId, ...guarantorRecord });
      }

      // 5. Log Audit Entry
      await trx('audit_logs').insert({
        actor_id: req.user.id,
        action_type: 'CREATE_LOAN',
        description: `Created new loan of LKR ${principal.toLocaleString()} (NIC: ${cleanNIC}, Rate: ${rate}%, Frequency: ${interest_type})${schedule ? ` over ${numInstallments} installments of LKR ${schedule.installmentAmount.toLocaleString()}` : ''}${guarantorRecord ? ` with guarantor '${guarantorRecord.full_name}'` : ''} for Borrower ID ${borrower_id}.`
      });

      return newLoan;
    });

    // Send notifications in background
    notifyLoanCreation({ borrower, principal, interestType: interest_type, tempPassword: borrowerTempPassword })
      .catch(err => console.error('Failed to dispatch notification:', err));

    res.status(201).json({
      message: 'Loan created successfully.',
      loan: loanResult,
      borrowerTemporaryPassword: borrowerTempPassword
    });

  } catch (error) {
    console.error('Loan creation error:', error);
    res.status(500).json({ message: 'Internal server error while creating loan.' });
  }
}

// Get all loans (Filtered by user role)
export async function getLoans(req, res) {
  try {
    const { role, id } = req.user;
    const { status, borrowerId } = req.query;

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

    // Apply RBAC filters
    if (role === 'agent') {
      query = query.where('loans.assigned_agent_id', id);
    } else if (role === 'borrower') {
      query = query.where('loans.borrower_id', id);
    }

    // Apply query filters
    if (status) {
      query = query.where('loans.status', status);
    }
    if (borrowerId && role === 'admin') {
      query = query.where('loans.borrower_id', borrowerId);
    }

    const loans = await query.orderBy('loans.created_at', 'desc');
    res.json(loans);
  } catch (error) {
    console.error('Fetch loans error:', error);
    res.status(500).json({ message: 'Failed to fetch loans.' });
  }
}

// Get detailed loan statement
export async function getLoanDetails(req, res) {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const loan = await db('loans')
      .join('users as borrowers', 'loans.borrower_id', 'borrowers.id')
      .leftJoin('users as agents', 'loans.assigned_agent_id', 'agents.id')
      .where('loans.id', id)
      .select(
        'loans.*',
        'borrowers.name as borrower_name',
        'borrowers.phone as borrower_phone',
        'agents.name as agent_name'
      )
      .first();

    if (!loan) {
      return res.status(404).json({ message: 'Loan not found.' });
    }

    // RBAC: borrower can only view their own loan
    if (role === 'borrower' && loan.borrower_id !== userId) {
      return res.status(403).json({ message: 'Access denied to this loan file.' });
    }

    // Fetch payments/collections
    const payments = await db('transactions')
      .join('users as agents', 'transactions.agent_id', 'agents.id')
      .where({ loan_id: id })
      .select('transactions.*', 'agents.name as agent_name')
      .orderBy('payment_date', 'desc');

    // Fetch interest accruals
    const accruals = await db('interest_accruals')
      .where({ loan_id: id })
      .orderBy('created_at', 'desc');

    // Fetch full ledger entries for strict auditing
    const ledger = await db('ledger_entries')
      .where({ loan_id: id })
      .orderBy('created_at', 'asc');

    // Fetch repayment schedule / passbook rows, if this loan has one
    const installments = await db('installments')
      .where({ loan_id: id })
      .orderBy('installment_number', 'asc');

    // Fetch guarantor, if this loan has one
    const guarantor = await db('guarantors').where({ loan_id: id }).first();

    res.json({
      loan,
      payments,
      accruals,
      ledger,
      installments,
      guarantor: guarantor || null
    });
  } catch (error) {
    console.error('Fetch loan details error:', error);
    res.status(500).json({ message: 'Failed to retrieve loan details.' });
  }
}

// Edit mutable loan terms — interest rate and assigned agent only.
// Principal/borrower are intentionally never editable here: they're the
// basis of every past ledger entry, so changing them after disbursement
// would silently desync the ledger from the loan record. (Admin only)
export async function updateLoan(req, res) {
  try {
    const { id } = req.params;
    const { interest_rate, assigned_agent_id } = req.body;

    const loan = await db('loans').where({ id }).first();
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found.' });
    }
    if (loan.status === 'fully_paid' || loan.status === 'defaulted') {
      return res.status(400).json({ message: `Cannot edit a loan with status '${loan.status}'.` });
    }

    const updates = {};
    const changes = [];

    if (interest_rate !== undefined) {
      const rate = parseFloat(interest_rate);
      if (isNaN(rate) || rate < 0) {
        return res.status(400).json({ message: 'Interest rate must be a non-negative number.' });
      }
      updates.interest_rate = rate;
      changes.push(`interest rate ${loan.interest_rate}% -> ${rate}%`);
    }

    if (assigned_agent_id !== undefined) {
      if (assigned_agent_id) {
        const agent = await db('users').where({ id: assigned_agent_id, role: 'agent' }).first();
        if (!agent) {
          return res.status(404).json({ message: 'Assigned agent not found.' });
        }
      }
      updates.assigned_agent_id = assigned_agent_id || null;
      changes.push(`assigned agent changed`);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No editable fields supplied (interest_rate, assigned_agent_id).' });
    }

    updates.updated_at = db.fn.now();
    await db('loans').where({ id }).update(updates);

    await db('audit_logs').insert({
      actor_id: req.user.id,
      action_type: 'UPDATE_LOAN',
      description: `Edited loan ID ${id}: ${changes.join(', ')}.`
    });

    const updatedLoan = await db('loans').where({ id }).first();
    res.json({ message: 'Loan updated successfully.', loan: updatedLoan });
  } catch (error) {
    console.error('Update loan error:', error);
    res.status(500).json({ message: 'Internal server error while updating loan.' });
  }
}

// Mark a loan as defaulted (Admin only) — blocks further payment collection
export async function markLoanDefaulted(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'A reason is required to mark a loan as defaulted.' });
    }

    const loan = await db('loans').where({ id }).first();
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found.' });
    }
    if (loan.status !== 'active') {
      return res.status(400).json({ message: `Only active loans can be marked defaulted (current status: '${loan.status}').` });
    }

    await db('loans').where({ id }).update({
      status: 'defaulted',
      default_reason: reason.trim(),
      defaulted_at: db.fn.now(),
      updated_at: db.fn.now()
    });

    await db('audit_logs').insert({
      actor_id: req.user.id,
      action_type: 'MARK_DEFAULTED',
      description: `Marked loan ID ${id} as defaulted. Reason: ${reason.trim()}. Outstanding balance: LKR ${parseFloat(loan.current_balance).toLocaleString()}.`
    });

    res.json({ message: 'Loan marked as defaulted.' });
  } catch (error) {
    console.error('Mark loan defaulted error:', error);
    res.status(500).json({ message: 'Internal server error while marking loan defaulted.' });
  }
}

// Apply a manual penalty / late fee to an active loan (Admin only)
export async function applyLoanPenalty(req, res) {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    const penaltyAmount = parseFloat(amount);
    if (isNaN(penaltyAmount) || penaltyAmount <= 0) {
      return res.status(400).json({ message: 'Penalty amount must be a positive number.' });
    }

    const result = await db.transaction(async (trx) => {
      const loan = await trx('loans').where({ id }).first().forUpdate();
      if (!loan) {
        throw new Error('Loan not found.');
      }
      if (loan.status !== 'active') {
        throw new Error(`Penalties can only be applied to active loans (current status: '${loan.status}').`);
      }

      const newBalance = parseFloat(loan.current_balance) + penaltyAmount;

      await trx('ledger_entries').insert([
        { loan_id: id, account: 'loan_receivable', type: 'debit', amount: penaltyAmount },
        { loan_id: id, account: 'penalty_revenue', type: 'credit', amount: penaltyAmount }
      ]);

      await trx('loans').where({ id }).update({ current_balance: newBalance, updated_at: trx.fn.now() });

      await trx('audit_logs').insert({
        actor_id: req.user.id,
        action_type: 'APPLY_PENALTY',
        description: `Applied penalty of LKR ${penaltyAmount.toLocaleString()} to loan ID ${id}${reason ? ` (${reason.trim()})` : ''}. New balance: LKR ${newBalance.toLocaleString()}.`
      });

      return { newBalance };
    });

    res.json({ message: 'Penalty applied and posted to ledger.', newBalance: result.newBalance });
  } catch (error) {
    console.error('Apply penalty error:', error);
    if (error.message.includes('not found') || error.message.includes('active loans')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal server error while applying penalty.' });
  }
}
