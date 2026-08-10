// Standalone migration script — run manually via `npm run db:migrate`,
// pointed at DATABASE_URL. Not run inside serverless functions: Vercel
// functions are short-lived and shouldn't carry schema-check overhead on
// every cold start, so this is a deliberate out-of-band step (run it once
// locally against your Supabase/Neon URL before first deploy, and again
// whenever the schema changes).
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const { default: db } = await import('../src/lib/db.js');
const { default: bcrypt } = await import('bcryptjs');

// Pre-hashed 'password123'
const HASHED_PASSWORD = '$2a$10$x536khR6NXKb2iCs08Q8E.6KO32STJCDvHyUTGWdW4AB8vI1vL9cS';

async function addColumnIfMissing(tableName, columnName, buildColumn) {
  const hasColumn = await db.schema.hasColumn(tableName, columnName);
  if (!hasColumn) {
    await db.schema.alterTable(tableName, (table) => buildColumn(table));
    console.log(`Migration: added column '${columnName}' to '${tableName}'.`);
  }
}

async function dropColumnIfPresent(tableName, columnName) {
  const hasColumn = await db.schema.hasColumn(tableName, columnName);
  if (hasColumn) {
    await db.schema.alterTable(tableName, (table) => table.dropColumn(columnName));
    console.log(`Migration: dropped column '${columnName}' from '${tableName}'.`);
  }
}

async function runIncrementalMigrations() {
  await addColumnIfMissing('users', 'must_change_password', (t) => t.boolean('must_change_password').defaultTo(false));
  await addColumnIfMissing('users', 'failed_login_attempts', (t) => t.integer('failed_login_attempts').defaultTo(0));
  await addColumnIfMissing('users', 'locked_until', (t) => t.timestamp('locked_until').nullable());

  // Login is phone-based now — email is no longer required.
  await db.schema.alterTable('users', (table) => {
    table.string('email', 100).nullable().alter();
  });

  // The real business phone becomes the primary admin login.
  const adminUpdate = await db('users')
    .where({ id: 'a1111111-1111-1111-1111-111111111111' })
    .update({ phone: '0774048194' });
  if (adminUpdate) {
    console.log('Migration: set primary admin phone to 0774048194.');
  }

  await addColumnIfMissing('loans', 'default_reason', (t) => t.text('default_reason').nullable());
  await addColumnIfMissing('loans', 'defaulted_at', (t) => t.timestamp('defaulted_at').nullable());

  // Interest-only loan model: principal_outstanding never grows from interest
  // (only principal payments touch it); interest_balance tracks unpaid
  // accrued interest separately, cleared by interest payments. Replaces the
  // earlier combined current_balance field.
  const hasOldBalanceCol = await db.schema.hasColumn('loans', 'current_balance');
  const hasNewPrincipalCol = await db.schema.hasColumn('loans', 'principal_outstanding');
  if (hasOldBalanceCol && !hasNewPrincipalCol) {
    await db.schema.alterTable('loans', (table) => table.renameColumn('current_balance', 'principal_outstanding'));
    console.log("Migration: renamed loans.current_balance -> loans.principal_outstanding.");
  }
  await addColumnIfMissing('loans', 'interest_balance', (t) => t.decimal('interest_balance', 15, 2).notNullable().defaultTo(0));

  // Installment-schedule feature removed — loans are interest-only now
  // (fixed principal, recurring interest, principal repaid whenever ready).
  await dropColumnIfPresent('loans', 'num_installments');
  await dropColumnIfPresent('loans', 'installment_amount');
  await dropColumnIfPresent('loans', 'total_repayable');
  if (await db.schema.hasTable('installments')) {
    await db.schema.dropTable('installments');
    console.log("Migration: dropped table 'installments'.");
  }

  // Every payment must say whether it's paying off interest or principal.
  await addColumnIfMissing('transactions', 'payment_type', (t) => t.string('payment_type', 20).notNullable().defaultTo('principal'));

  // Borrower profile snapshot at time of loan application (mirrors the STN
  // applicant personal-info form) — optional, per-loan like the guarantor.
  await addColumnIfMissing('loans', 'loan_purpose', (t) => t.text('loan_purpose').nullable());
  await addColumnIfMissing('loans', 'dependents_count', (t) => t.integer('dependents_count').nullable());
  await addColumnIfMissing('loans', 'monthly_income', (t) => t.decimal('monthly_income', 15, 2).nullable());
  await addColumnIfMissing('loans', 'spouse_name', (t) => t.string('spouse_name', 150).nullable());
  await addColumnIfMissing('loans', 'spouse_nic', (t) => t.string('spouse_nic', 50).nullable());
  await addColumnIfMissing('loans', 'spouse_occupation', (t) => t.string('spouse_occupation', 150).nullable());

  if (!(await db.schema.hasTable('remittances'))) {
    await db.schema.createTable('remittances', (table) => {
      table.uuid('id').primary().defaultTo(db.fn.uuid());
      table.uuid('agent_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      table.decimal('amount', 15, 2).notNullable();
      table.text('notes');
      table.string('status', 20).notNullable().defaultTo('pending');
      table.uuid('verified_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('verified_at').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    console.log("Migration: created table 'remittances'.");
  }

  if (!(await db.schema.hasTable('guarantors'))) {
    await db.schema.createTable('guarantors', (table) => {
      table.uuid('id').primary().defaultTo(db.fn.uuid());
      table.uuid('loan_id').notNullable().references('id').inTable('loans').onDelete('CASCADE');
      table.string('full_name', 150).notNullable();
      table.string('nic_number', 50).notNullable();
      table.string('gender', 10);
      table.string('ethnicity', 100);
      table.date('date_of_birth');
      table.text('address').notNullable();
      table.string('phone', 20).notNullable();
      table.string('email', 100);
      table.boolean('protected_under_debt_act').defaultTo(false);
      table.boolean('has_pending_court_cases').defaultTo(false);
      table.decimal('monthly_income_business', 15, 2).defaultTo(0);
      table.decimal('monthly_income_agriculture', 15, 2).defaultTo(0);
      table.decimal('monthly_income_other', 15, 2).defaultTo(0);
      table.decimal('monthly_expense_food', 15, 2).defaultTo(0);
      table.decimal('monthly_expense_rent', 15, 2).defaultTo(0);
      table.decimal('monthly_expense_other', 15, 2).defaultTo(0);
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    console.log("Migration: created table 'guarantors'.");
  }

  // Day-by-day collection log (mirrors the physical passbook: did the
  // borrower pay today or not). 'paid'/'partial' rows are linked to a real
  // transaction so the log stays consistent with the ledger — it's a view
  // on top of real payments, not a separate source of truth.
  if (!(await db.schema.hasTable('daily_collections'))) {
    await db.schema.createTable('daily_collections', (table) => {
      table.uuid('id').primary().defaultTo(db.fn.uuid());
      table.uuid('loan_id').notNullable().references('id').inTable('loans').onDelete('CASCADE');
      table.date('collection_date').notNullable();
      table.string('status', 20).notNullable(); // 'paid', 'partial', 'not_paid'
      table.decimal('amount', 15, 2).nullable();
      table.uuid('transaction_id').references('id').inTable('transactions').onDelete('SET NULL');
      table.uuid('marked_by').references('id').inTable('users').onDelete('SET NULL');
      table.text('notes').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.unique(['loan_id', 'collection_date']);
    });
    console.log("Migration: created table 'daily_collections'.");
  }

  // Borrowers no longer log in — the app collects full KYC details
  // (address, etc.) at loan disbursement instead of via a borrower
  // self-service account. Address is captured per-loan, the same as
  // nic_number, since it's part of the loan file the physical passbook
  // records at disbursement time.
  await addColumnIfMissing('loans', 'borrower_address', (t) => t.text('borrower_address').nullable());

  // Write-off support — previously a defaulted loan's balances sat on the
  // books forever with no way to formally close them out as bad debt.
  await addColumnIfMissing('loans', 'write_off_amount', (t) => t.decimal('write_off_amount', 15, 2).nullable());
  await addColumnIfMissing('loans', 'write_off_reason', (t) => t.text('write_off_reason').nullable());
  await addColumnIfMissing('loans', 'written_off_at', (t) => t.timestamp('written_off_at').nullable());

  // Remittances can now be disputed/rejected, not just verified.
  await addColumnIfMissing('remittances', 'rejection_reason', (t) => t.text('rejection_reason').nullable());

  await addColumnIfMissing('loans', 'collection_mode', (t) => t.string('collection_mode', 30).notNullable().defaultTo('passbook'));
  await addColumnIfMissing('loans', 'duration_periods', (t) => t.integer('duration_periods').nullable());
  await addColumnIfMissing('loans', 'maturity_date', (t) => t.timestamp('maturity_date').nullable());

  // Add gender column to users table
  await addColumnIfMissing('users', 'gender', (t) => t.string('gender', 10).nullable());

  // reference_number existed in the fresh-install schema but was never
  // added here — a DB that went through incremental migrations instead of
  // a fresh install would never actually get this column.
  await addColumnIfMissing('loans', 'reference_number', (t) => t.string('reference_number', 50).unique().nullable());

  // Agent-submitted loan applications ("status": 'pending') need
  // admin sign-off before they're actually disbursed — see the loans
  // create/approve/reject routes.
  await addColumnIfMissing('loans', 'approved_by', (t) => t.uuid('approved_by').references('id').inTable('users').onDelete('SET NULL'));
  await addColumnIfMissing('loans', 'approved_at', (t) => t.timestamp('approved_at').nullable());
  await addColumnIfMissing('loans', 'loan_rejection_reason', (t) => t.text('loan_rejection_reason').nullable());
  await addColumnIfMissing('loans', 'rejected_at', (t) => t.timestamp('rejected_at').nullable());

  // Borrower's date of birth, captured per-loan alongside NIC/address (same
  // pattern — these are per-application KYC snapshot fields, not shared
  // account fields on the users table).
  await addColumnIfMissing('loans', 'date_of_birth', (t) => t.date('date_of_birth').nullable());

  // Guarantor NIC photo — mirrors loans.nic_photo_url (base64 data URL,
  // stored directly in the DB since Vercel's filesystem is ephemeral).
  await addColumnIfMissing('guarantors', 'nic_photo_url', (t) => t.text('nic_photo_url').nullable());

  // Address proof photo (e.g. a utility bill or similar), required at loan
  // creation for both the borrower and every guarantor — same base64-in-DB
  // storage pattern as the NIC photos.
  await addColumnIfMissing('loans', 'address_proof_url', (t) => t.text('address_proof_url').nullable());
  await addColumnIfMissing('guarantors', 'address_proof_url', (t) => t.text('address_proof_url').nullable());
}

async function createSchemaAndSeed() {
  console.log('Initializing database schema...');

  await db.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(db.fn.uuid());
    table.string('name', 100).notNullable();
    table.string('email', 100).unique().nullable(); // legacy field, no longer used for login
    table.string('phone', 20).unique().notNullable();
    table.string('gender', 10).nullable();
    table.string('password_hash', 255).notNullable();
    table.string('role', 20).notNullable(); // 'admin', 'agent', 'borrower'
    table.boolean('is_active').defaultTo(true);
    table.boolean('must_change_password').defaultTo(false);
    table.integer('failed_login_attempts').defaultTo(0);
    table.timestamp('locked_until').nullable();
    table.timestamps(true, true);
  });

  await db.schema.createTable('loans', (table) => {
    table.uuid('id').primary().defaultTo(db.fn.uuid());
    table.uuid('borrower_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('lender_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('assigned_agent_id').references('id').inTable('users').onDelete('SET NULL');
    table.decimal('principal_amount', 15, 2).notNullable();
    table.decimal('interest_rate', 5, 2).notNullable();
    table.string('interest_type', 20).notNullable(); // 'daily', 'weekly', 'monthly'
    // Interest-only model: principal_outstanding only decreases via
    // principal payments (never grows from interest); interest_balance is
    // the running unpaid-interest amount, cleared by interest payments.
    table.decimal('principal_outstanding', 15, 2).notNullable();
    table.decimal('interest_balance', 15, 2).notNullable().defaultTo(0);
    table.string('status', 20).defaultTo('active'); // 'pending', 'active', 'fully_paid', 'defaulted', 'written_off', 'rejected'
    table.timestamp('last_accrual_date').defaultTo(db.fn.now());
    table.timestamp('next_accrual_date').notNullable();
    table.string('reference_number', 50).unique().nullable();
    table.string('nic_number', 50);
    table.text('nic_photo_url');
    table.text('address_proof_url');
    table.date('date_of_birth').nullable();
    table.text('borrower_address').nullable();
    table.text('default_reason').nullable();
    table.timestamp('defaulted_at').nullable();
    table.decimal('write_off_amount', 15, 2).nullable();
    table.text('write_off_reason').nullable();
    table.timestamp('written_off_at').nullable();
    table.uuid('approved_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('approved_at').nullable();
    table.text('loan_rejection_reason').nullable();
    table.timestamp('rejected_at').nullable();
    table.text('loan_purpose').nullable();
    table.integer('dependents_count').nullable();
    table.decimal('monthly_income', 15, 2).nullable();
    table.string('spouse_name', 150).nullable();
    table.string('spouse_nic', 50).nullable();
    table.string('spouse_occupation', 150).nullable();
    table.string('collection_mode', 30).notNullable().defaultTo('passbook');
    table.integer('duration_periods').nullable();
    table.timestamp('maturity_date').nullable();
    table.timestamps(true, true);

    table.index('borrower_id');
    table.index('assigned_agent_id');
    table.index(['status', 'next_accrual_date']);
  });

  await db.schema.createTable('transactions', (table) => {
    table.uuid('id').primary().defaultTo(db.fn.uuid());
    table.uuid('loan_id').notNullable().references('id').inTable('loans').onDelete('RESTRICT');
    table.uuid('agent_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('borrower_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.decimal('amount', 15, 2).notNullable();
    table.string('payment_type', 20).notNullable().defaultTo('principal'); // 'interest' or 'principal'
    table.timestamp('payment_date').defaultTo(db.fn.now());
    table.text('notes');
    table.text('proof_image_url');
    table.string('payment_method', 50).defaultTo('cash');
    table.string('idempotency_key', 255).unique().notNullable();
    table.timestamp('created_at').defaultTo(db.fn.now());

    table.index('loan_id');
    table.index('agent_id');
    table.index('payment_date');
  });

  await db.schema.createTable('interest_accruals', (table) => {
    table.uuid('id').primary().defaultTo(db.fn.uuid());
    table.uuid('loan_id').notNullable().references('id').inTable('loans').onDelete('RESTRICT');
    table.decimal('amount_accrued', 15, 2).notNullable();
    table.text('calculation_log').notNullable();
    table.timestamp('created_at').defaultTo(db.fn.now());

    table.index('loan_id');
    table.index('created_at');
  });

  await db.schema.createTable('ledger_entries', (table) => {
    table.uuid('id').primary().defaultTo(db.fn.uuid());
    table.uuid('loan_id').references('id').inTable('loans').onDelete('SET NULL');
    table.uuid('transaction_id').references('id').inTable('transactions').onDelete('SET NULL');
    table.string('account', 30).notNullable(); // 'cash_agent', 'cash_office', 'loan_receivable_principal', 'loan_receivable_interest', 'interest_revenue', 'penalty_revenue', 'written_off_expense'
    table.string('type', 10).notNullable(); // 'debit', 'credit'
    table.decimal('amount', 15, 2).notNullable();
    table.timestamp('created_at').defaultTo(db.fn.now());

    table.index('loan_id');
  });

  await db.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(db.fn.uuid());
    table.uuid('actor_id').references('id').inTable('users').onDelete('SET NULL');
    table.string('action_type', 100).notNullable();
    table.text('description').notNullable();
    table.string('ip_address', 45);
    table.string('user_agent', 255);
    table.timestamp('created_at').defaultTo(db.fn.now());
  });

  await db.schema.createTable('remittances', (table) => {
    table.uuid('id').primary().defaultTo(db.fn.uuid());
    table.uuid('agent_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.decimal('amount', 15, 2).notNullable();
    table.text('notes');
    table.string('status', 20).notNullable().defaultTo('pending'); // 'pending', 'verified', 'rejected'
    table.uuid('verified_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('verified_at').nullable();
    table.text('rejection_reason').nullable();
    table.timestamp('created_at').defaultTo(db.fn.now());
  });

  await db.schema.createTable('guarantors', (table) => {
    table.uuid('id').primary().defaultTo(db.fn.uuid());
    table.uuid('loan_id').notNullable().references('id').inTable('loans').onDelete('CASCADE');
    table.string('full_name', 150).notNullable();
    table.string('nic_number', 50).notNullable();
    table.string('gender', 10);
    table.string('ethnicity', 100);
    table.date('date_of_birth');
    table.text('address').notNullable();
    table.string('phone', 20).notNullable();
    table.string('email', 100);
    table.text('nic_photo_url');
    table.text('address_proof_url');
    table.boolean('protected_under_debt_act').defaultTo(false);
    table.boolean('has_pending_court_cases').defaultTo(false);
    table.decimal('monthly_income_business', 15, 2).defaultTo(0);
    table.decimal('monthly_income_agriculture', 15, 2).defaultTo(0);
    table.decimal('monthly_income_other', 15, 2).defaultTo(0);
    table.decimal('monthly_expense_food', 15, 2).defaultTo(0);
    table.decimal('monthly_expense_rent', 15, 2).defaultTo(0);
    table.decimal('monthly_expense_other', 15, 2).defaultTo(0);
    table.timestamp('created_at').defaultTo(db.fn.now());
  });

  await db.schema.createTable('daily_collections', (table) => {
    table.uuid('id').primary().defaultTo(db.fn.uuid());
    table.uuid('loan_id').notNullable().references('id').inTable('loans').onDelete('CASCADE');
    table.date('collection_date').notNullable();
    table.string('status', 20).notNullable(); // 'paid', 'partial', 'not_paid'
    table.decimal('amount', 15, 2).nullable();
    table.uuid('transaction_id').references('id').inTable('transactions').onDelete('SET NULL');
    table.uuid('marked_by').references('id').inTable('users').onDelete('SET NULL');
    table.text('notes').nullable();
    table.timestamp('created_at').defaultTo(db.fn.now());
    table.unique(['loan_id', 'collection_date']);
  });

  console.log('Database tables created successfully.');
  console.log('Seeding initial demo data...');

  const users = [
    { id: 'a1111111-1111-1111-1111-111111111111', name: 'Lender Admin', phone: '0774048194', password_hash: HASHED_PASSWORD, role: 'admin' },
    { id: 'a2222222-2222-2222-2222-222222222222', name: 'Agent Amal', phone: '+94777654321', password_hash: HASHED_PASSWORD, role: 'agent' },
    { id: 'a3333333-3333-3333-3333-333333333333', name: 'Borrower Bandara', phone: '+94778888888', password_hash: HASHED_PASSWORD, role: 'borrower' },
    { id: 'a4444444-4444-4444-4444-444444444444', name: 'Borrower Chandana', phone: '+94779999999', password_hash: HASHED_PASSWORD, role: 'borrower' }
  ];
  await db('users').insert(users);
  console.log('Users seeded (login by phone, password: password123). Primary admin phone: 0774048194.');

  const baseDate = new Date();
  const lastAccrualDaily = new Date(baseDate.getTime() - 24 * 60 * 60 * 1000);
  const nextAccrualDaily = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
  const lastAccrualWeekly = new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const nextAccrualWeekly = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  await db('loans').insert([
    {
      id: 'b1111111-1111-1111-1111-111111111111',
      borrower_id: 'a3333333-3333-3333-3333-333333333333',
      lender_id: 'a1111111-1111-1111-1111-111111111111',
      assigned_agent_id: 'a2222222-2222-2222-2222-222222222222',
      principal_amount: 100000.00, interest_rate: 2.00, interest_type: 'daily',
      // 100k principal untouched by interest; borrower has paid off 2,000 of
      // the 2,000 interest accrued so far, and made a 15,000 principal payment.
      principal_outstanding: 85000.00, interest_balance: 0.00, status: 'active',
      last_accrual_date: lastAccrualDaily, next_accrual_date: nextAccrualDaily,
      created_at: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000)
    },
    {
      id: 'b2222222-2222-2222-2222-222222222222',
      borrower_id: 'a4444444-4444-4444-4444-444444444444',
      lender_id: 'a1111111-1111-1111-1111-111111111111',
      assigned_agent_id: 'a2222222-2222-2222-2222-222222222222',
      principal_amount: 250000.00, interest_rate: 5.00, interest_type: 'weekly',
      // 250k principal untouched; the 12,500 interest accrued so far is
      // still unpaid.
      principal_outstanding: 250000.00, interest_balance: 12500.00, status: 'active',
      last_accrual_date: lastAccrualWeekly, next_accrual_date: nextAccrualWeekly,
      created_at: new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000)
    }
  ]);
  console.log('Loans seeded.');

  await db('transactions').insert([
    {
      id: 'c1111111-1111-1111-1111-111111111111',
      loan_id: 'b1111111-1111-1111-1111-111111111111',
      agent_id: 'a2222222-2222-2222-2222-222222222222',
      borrower_id: 'a3333333-3333-3333-3333-333333333333',
      amount: 15000.00,
      payment_type: 'principal',
      payment_date: new Date(baseDate.getTime() - 12 * 60 * 60 * 1000),
      notes: 'Partial principal repayment in cash',
      idempotency_key: 'idemp_sample_123',
      created_at: new Date(baseDate.getTime() - 12 * 60 * 60 * 1000)
    },
    {
      id: 'c2222222-2222-2222-2222-222222222222',
      loan_id: 'b1111111-1111-1111-1111-111111111111',
      agent_id: 'a2222222-2222-2222-2222-222222222222',
      borrower_id: 'a3333333-3333-3333-3333-333333333333',
      amount: 2000.00,
      payment_type: 'interest',
      payment_date: lastAccrualDaily,
      notes: 'Daily interest payment',
      idempotency_key: 'idemp_sample_124',
      created_at: lastAccrualDaily
    }
  ]);
  console.log('Transactions seeded.');

  await db('interest_accruals').insert([
    { loan_id: 'b1111111-1111-1111-1111-111111111111', amount_accrued: 2000.00, calculation_log: 'Principal: 100000.00 | Rate: 2% | Type: daily', created_at: lastAccrualDaily },
    { loan_id: 'b2222222-2222-2222-2222-222222222222', amount_accrued: 12500.00, calculation_log: 'Principal: 250000.00 | Rate: 5% | Type: weekly', created_at: lastAccrualWeekly }
  ]);
  console.log('Interest accruals seeded.');

  await db('ledger_entries').insert([
    { loan_id: 'b1111111-1111-1111-1111-111111111111', account: 'loan_receivable_principal', type: 'debit', amount: 100000.00, created_at: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000) },
    { loan_id: 'b1111111-1111-1111-1111-111111111111', account: 'cash_office', type: 'credit', amount: 100000.00, created_at: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000) },
    { loan_id: 'b1111111-1111-1111-1111-111111111111', account: 'loan_receivable_interest', type: 'debit', amount: 2000.00, created_at: lastAccrualDaily },
    { loan_id: 'b1111111-1111-1111-1111-111111111111', account: 'interest_revenue', type: 'credit', amount: 2000.00, created_at: lastAccrualDaily },
    { loan_id: 'b1111111-1111-1111-1111-111111111111', transaction_id: 'c2222222-2222-2222-2222-222222222222', account: 'cash_agent', type: 'debit', amount: 2000.00, created_at: lastAccrualDaily },
    { loan_id: 'b1111111-1111-1111-1111-111111111111', transaction_id: 'c2222222-2222-2222-2222-222222222222', account: 'loan_receivable_interest', type: 'credit', amount: 2000.00, created_at: lastAccrualDaily },
    { loan_id: 'b1111111-1111-1111-1111-111111111111', transaction_id: 'c1111111-1111-1111-1111-111111111111', account: 'cash_agent', type: 'debit', amount: 15000.00, created_at: new Date(baseDate.getTime() - 12 * 60 * 60 * 1000) },
    { loan_id: 'b1111111-1111-1111-1111-111111111111', transaction_id: 'c1111111-1111-1111-1111-111111111111', account: 'loan_receivable_principal', type: 'credit', amount: 15000.00, created_at: new Date(baseDate.getTime() - 12 * 60 * 60 * 1000) },
    { loan_id: 'b2222222-2222-2222-2222-222222222222', account: 'loan_receivable_principal', type: 'debit', amount: 250000.00, created_at: new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000) },
    { loan_id: 'b2222222-2222-2222-2222-222222222222', account: 'cash_office', type: 'credit', amount: 250000.00, created_at: new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000) },
    { loan_id: 'b2222222-2222-2222-2222-222222222222', account: 'loan_receivable_interest', type: 'debit', amount: 12500.00, created_at: lastAccrualWeekly },
    { loan_id: 'b2222222-2222-2222-2222-222222222222', account: 'interest_revenue', type: 'credit', amount: 12500.00, created_at: lastAccrualWeekly }
  ]);
  console.log('Ledger entries seeded.');

  await db('audit_logs').insert([
    { actor_id: 'a1111111-1111-1111-1111-111111111111', action_type: 'CREATE_LOAN', description: 'Lender Admin created a Daily loan of 100,000 LKR for Borrower Bandara.', created_at: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000) },
    { actor_id: 'a1111111-1111-1111-1111-111111111111', action_type: 'CREATE_LOAN', description: 'Lender Admin created a Weekly loan of 250,000 LKR for Borrower Chandana.', created_at: new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000) },
    { actor_id: 'a2222222-2222-2222-2222-222222222222', action_type: 'RECORD_PAYMENT', description: 'Agent Amal collected 15,000 LKR principal repayment for Borrower Bandara.', created_at: new Date(baseDate.getTime() - 12 * 60 * 60 * 1000) }
  ]);
  console.log('Audit logs seeded.');
}

async function main() {
  const isFreshInstall = !(await db.schema.hasTable('users'));

  if (isFreshInstall) {
    await createSchemaAndSeed();
  } else {
    console.log('Tables already exist — checking for incremental schema migrations...');
  }

  await runIncrementalMigrations();
  console.log('Migration complete.');
}

main()
  .then(() => db.destroy())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    db.destroy().finally(() => process.exit(1));
  });
