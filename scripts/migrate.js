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

async function runIncrementalMigrations() {
  await addColumnIfMissing('users', 'must_change_password', (t) => t.boolean('must_change_password').defaultTo(false));
  await addColumnIfMissing('users', 'failed_login_attempts', (t) => t.integer('failed_login_attempts').defaultTo(0));
  await addColumnIfMissing('users', 'locked_until', (t) => t.timestamp('locked_until').nullable());

  await addColumnIfMissing('loans', 'default_reason', (t) => t.text('default_reason').nullable());
  await addColumnIfMissing('loans', 'defaulted_at', (t) => t.timestamp('defaulted_at').nullable());
  await addColumnIfMissing('loans', 'num_installments', (t) => t.integer('num_installments').nullable());
  await addColumnIfMissing('loans', 'installment_amount', (t) => t.decimal('installment_amount', 15, 2).nullable());
  await addColumnIfMissing('loans', 'total_repayable', (t) => t.decimal('total_repayable', 15, 2).nullable());

  if (!(await db.schema.hasTable('installments'))) {
    await db.schema.createTable('installments', (table) => {
      table.uuid('id').primary().defaultTo(db.fn.uuid());
      table.uuid('loan_id').notNullable().references('id').inTable('loans').onDelete('CASCADE');
      table.integer('installment_number').notNullable();
      table.timestamp('due_date').notNullable();
      table.decimal('expected_amount', 15, 2).notNullable();
      table.decimal('paid_amount', 15, 2).notNullable().defaultTo(0);
      table.timestamp('paid_at').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    console.log("Migration: created table 'installments'.");
  }

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
}

async function createSchemaAndSeed() {
  console.log('Initializing database schema...');

  await db.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(db.fn.uuid());
    table.string('name', 100).notNullable();
    table.string('email', 100).unique().notNullable();
    table.string('phone', 20).unique().notNullable();
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
    table.decimal('current_balance', 15, 2).notNullable();
    table.string('status', 20).defaultTo('active'); // 'pending', 'active', 'fully_paid', 'defaulted'
    table.timestamp('last_accrual_date').defaultTo(db.fn.now());
    table.timestamp('next_accrual_date').notNullable();
    table.string('nic_number', 50);
    table.text('nic_photo_url');
    table.text('default_reason').nullable();
    table.timestamp('defaulted_at').nullable();
    table.integer('num_installments').nullable();
    table.decimal('installment_amount', 15, 2).nullable();
    table.decimal('total_repayable', 15, 2).nullable();
    table.timestamps(true, true);
  });

  await db.schema.createTable('installments', (table) => {
    table.uuid('id').primary().defaultTo(db.fn.uuid());
    table.uuid('loan_id').notNullable().references('id').inTable('loans').onDelete('CASCADE');
    table.integer('installment_number').notNullable();
    table.timestamp('due_date').notNullable();
    table.decimal('expected_amount', 15, 2).notNullable();
    table.decimal('paid_amount', 15, 2).notNullable().defaultTo(0);
    table.timestamp('paid_at').nullable();
    table.timestamp('created_at').defaultTo(db.fn.now());
  });

  await db.schema.createTable('transactions', (table) => {
    table.uuid('id').primary().defaultTo(db.fn.uuid());
    table.uuid('loan_id').notNullable().references('id').inTable('loans').onDelete('RESTRICT');
    table.uuid('agent_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('borrower_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.decimal('amount', 15, 2).notNullable();
    table.timestamp('payment_date').defaultTo(db.fn.now());
    table.text('notes');
    table.text('proof_image_url');
    table.string('payment_method', 50).defaultTo('cash');
    table.string('idempotency_key', 255).unique().notNullable();
    table.timestamp('created_at').defaultTo(db.fn.now());
  });

  await db.schema.createTable('interest_accruals', (table) => {
    table.uuid('id').primary().defaultTo(db.fn.uuid());
    table.uuid('loan_id').notNullable().references('id').inTable('loans').onDelete('RESTRICT');
    table.decimal('amount_accrued', 15, 2).notNullable();
    table.text('calculation_log').notNullable();
    table.timestamp('created_at').defaultTo(db.fn.now());
  });

  await db.schema.createTable('ledger_entries', (table) => {
    table.uuid('id').primary().defaultTo(db.fn.uuid());
    table.uuid('loan_id').references('id').inTable('loans').onDelete('SET NULL');
    table.uuid('transaction_id').references('id').inTable('transactions').onDelete('SET NULL');
    table.string('account', 30).notNullable(); // 'cash_agent', 'cash_office', 'loan_receivable', 'interest_revenue'
    table.string('type', 10).notNullable(); // 'debit', 'credit'
    table.decimal('amount', 15, 2).notNullable();
    table.timestamp('created_at').defaultTo(db.fn.now());
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
    table.string('status', 20).notNullable().defaultTo('pending'); // 'pending', 'verified'
    table.uuid('verified_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('verified_at').nullable();
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

  console.log('Database tables created successfully.');
  console.log('Seeding initial demo data...');

  const users = [
    { id: 'a1111111-1111-1111-1111-111111111111', name: 'Lender Admin', email: 'admin@lend.com', phone: '+94771234567', password_hash: HASHED_PASSWORD, role: 'admin' },
    { id: 'a2222222-2222-2222-2222-222222222222', name: 'Agent Amal', email: 'agent@lend.com', phone: '+94777654321', password_hash: HASHED_PASSWORD, role: 'agent' },
    { id: 'a3333333-3333-3333-3333-333333333333', name: 'Borrower Bandara', email: 'borrower@lend.com', phone: '+94778888888', password_hash: HASHED_PASSWORD, role: 'borrower' },
    { id: 'a4444444-4444-4444-4444-444444444444', name: 'Borrower Chandana', email: 'borrower2@lend.com', phone: '+94779999999', password_hash: HASHED_PASSWORD, role: 'borrower' }
  ];
  await db('users').insert(users);
  console.log('Users seeded (admin@lend.com / agent@lend.com / borrower@lend.com, password: password123).');

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
      current_balance: 87000.00, status: 'active',
      last_accrual_date: lastAccrualDaily, next_accrual_date: nextAccrualDaily,
      created_at: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000)
    },
    {
      id: 'b2222222-2222-2222-2222-222222222222',
      borrower_id: 'a4444444-4444-4444-4444-444444444444',
      lender_id: 'a1111111-1111-1111-1111-111111111111',
      assigned_agent_id: 'a2222222-2222-2222-2222-222222222222',
      principal_amount: 250000.00, interest_rate: 5.00, interest_type: 'weekly',
      current_balance: 262500.00, status: 'active',
      last_accrual_date: lastAccrualWeekly, next_accrual_date: nextAccrualWeekly,
      created_at: new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000)
    }
  ]);
  console.log('Loans seeded.');

  await db('transactions').insert({
    id: 'c1111111-1111-1111-1111-111111111111',
    loan_id: 'b1111111-1111-1111-1111-111111111111',
    agent_id: 'a2222222-2222-2222-2222-222222222222',
    borrower_id: 'a3333333-3333-3333-3333-333333333333',
    amount: 15000.00,
    payment_date: new Date(baseDate.getTime() - 12 * 60 * 60 * 1000),
    notes: 'Partial repayment in cash',
    idempotency_key: 'idemp_sample_123',
    created_at: new Date(baseDate.getTime() - 12 * 60 * 60 * 1000)
  });
  console.log('Transactions seeded.');

  await db('interest_accruals').insert([
    { loan_id: 'b1111111-1111-1111-1111-111111111111', amount_accrued: 2000.00, calculation_log: 'Principal: 100000.00 | Rate: 2% | Type: daily', created_at: lastAccrualDaily },
    { loan_id: 'b2222222-2222-2222-2222-222222222222', amount_accrued: 12500.00, calculation_log: 'Principal: 250000.00 | Rate: 5% | Type: weekly', created_at: lastAccrualWeekly }
  ]);
  console.log('Interest accruals seeded.');

  await db('ledger_entries').insert([
    { loan_id: 'b1111111-1111-1111-1111-111111111111', account: 'loan_receivable', type: 'debit', amount: 100000.00, created_at: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000) },
    { loan_id: 'b1111111-1111-1111-1111-111111111111', account: 'cash_office', type: 'credit', amount: 100000.00, created_at: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000) },
    { loan_id: 'b1111111-1111-1111-1111-111111111111', account: 'loan_receivable', type: 'debit', amount: 2000.00, created_at: lastAccrualDaily },
    { loan_id: 'b1111111-1111-1111-1111-111111111111', account: 'interest_revenue', type: 'credit', amount: 2000.00, created_at: lastAccrualDaily },
    { loan_id: 'b1111111-1111-1111-1111-111111111111', transaction_id: 'c1111111-1111-1111-1111-111111111111', account: 'cash_agent', type: 'debit', amount: 15000.00, created_at: new Date(baseDate.getTime() - 12 * 60 * 60 * 1000) },
    { loan_id: 'b1111111-1111-1111-1111-111111111111', transaction_id: 'c1111111-1111-1111-1111-111111111111', account: 'loan_receivable', type: 'credit', amount: 15000.00, created_at: new Date(baseDate.getTime() - 12 * 60 * 60 * 1000) },
    { loan_id: 'b2222222-2222-2222-2222-222222222222', account: 'loan_receivable', type: 'debit', amount: 250000.00, created_at: new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000) },
    { loan_id: 'b2222222-2222-2222-2222-222222222222', account: 'cash_office', type: 'credit', amount: 250000.00, created_at: new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000) },
    { loan_id: 'b2222222-2222-2222-2222-222222222222', account: 'loan_receivable', type: 'debit', amount: 12500.00, created_at: lastAccrualWeekly },
    { loan_id: 'b2222222-2222-2222-2222-222222222222', account: 'interest_revenue', type: 'credit', amount: 12500.00, created_at: lastAccrualWeekly }
  ]);
  console.log('Ledger entries seeded.');

  await db('audit_logs').insert([
    { actor_id: 'a1111111-1111-1111-1111-111111111111', action_type: 'CREATE_LOAN', description: 'Lender Admin created a Daily loan of 100,000 LKR for Borrower Bandara.', created_at: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000) },
    { actor_id: 'a1111111-1111-1111-1111-111111111111', action_type: 'CREATE_LOAN', description: 'Lender Admin created a Weekly loan of 250,000 LKR for Borrower Chandana.', created_at: new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000) },
    { actor_id: 'a2222222-2222-2222-2222-222222222222', action_type: 'RECORD_PAYMENT', description: 'Agent Amal collected 15,000 LKR for Borrower Bandara.', created_at: new Date(baseDate.getTime() - 12 * 60 * 60 * 1000) }
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
