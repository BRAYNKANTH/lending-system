// Standalone migration script for the PLATFORM (control-plane) database —
// run manually via `npm run db:migrate:platform`, pointed at
// PLATFORM_DATABASE_URL. This is a completely separate Supabase project
// from any tenant organization's own database (see scripts/migrate.js for
// that one) — it only ever holds the organization registry and the
// master-admin login(s) who manage it, never any org's loan/borrower data.
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import knexFactory from 'knex';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

if (!process.env.PLATFORM_DATABASE_URL) {
  console.error('PLATFORM_DATABASE_URL is not set. Add it to .env.local (see .env.local.example) — this must point at a dedicated Supabase project for the platform/control-plane, separate from any tenant org\'s DATABASE_URL.');
  process.exit(1);
}

const db = knexFactory({
  client: 'pg',
  connection: {
    connectionString: process.env.PLATFORM_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  }
});

async function createSchema() {
  await db.schema.createTable('platform_admins', (table) => {
    table.uuid('id').primary().defaultTo(db.fn.uuid());
    table.string('name', 100).notNullable();
    table.string('email', 150).unique().notNullable();
    table.string('phone', 20).nullable();
    table.string('password_hash', 255).notNullable();
    table.boolean('is_active').defaultTo(true);
    table.boolean('must_change_password').defaultTo(false);
    table.integer('failed_login_attempts').defaultTo(0);
    table.timestamp('locked_until').nullable();
    table.timestamps(true, true);
  });
  console.log('Created table: platform_admins');

  await db.schema.createTable('organizations', (table) => {
    table.uuid('id').primary().defaultTo(db.fn.uuid());
    table.string('name', 150).notNullable(); // Display name shown in their app (header, login screen, PDF, SMS)
    table.string('slug', 80).unique().notNullable(); // URL-safe short code, e.g. "stn-micro-credit"
    table.text('logo_url').nullable(); // Data URL or hosted image URL
    table.string('primary_color', 20).nullable(); // Optional hex, reserved for future per-org theming
    table.string('contact_name', 100).nullable();
    table.string('contact_email', 150).nullable();
    table.string('contact_phone', 20).nullable();
    // The org's own Supabase connection string — this is a sensitive
    // credential (full read/write access to that org's financial data), so
    // it's only ever readable/writable through the authenticated
    // platform-admin API, never exposed to any tenant-app user.
    table.text('database_url').nullable();
    table.string('custom_domain', 150).nullable();
    table.string('status', 20).notNullable().defaultTo('active'); // 'active' | 'trial' | 'suspended'
    table.text('notes').nullable(); // Free-text ops notes (plan tier, billing, onboarding status, etc.)
    table.timestamps(true, true);
  });
  console.log('Created table: organizations');
}

async function seedInitialAdmin() {
  const count = await db('platform_admins').count('id as c').first();
  if (Number(count.c) > 0) return; // Already has at least one admin — nothing to do.

  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const name = process.env.PLATFORM_ADMIN_NAME || 'Platform Admin';

  if (!email || !password) {
    console.log('\nNo platform_admins exist yet, and PLATFORM_ADMIN_EMAIL/PLATFORM_ADMIN_PASSWORD are not set.');
    console.log('Set both in .env.local and re-run this script to create your first master-admin login, e.g.:');
    console.log('  PLATFORM_ADMIN_EMAIL=you@example.com');
    console.log('  PLATFORM_ADMIN_PASSWORD=choose-a-strong-password');
    console.log('  PLATFORM_ADMIN_NAME=Your Name   (optional)\n');
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await db('platform_admins').insert({ name, email, password_hash: hash });
  console.log(`\nCreated initial platform admin: ${email}\n`);
}

async function main() {
  const isFreshInstall = !(await db.schema.hasTable('platform_admins'));
  if (isFreshInstall) {
    await createSchema();
  } else {
    console.log('Platform tables already exist — nothing to migrate.');
  }
  await seedInitialAdmin();
  console.log('Platform migration complete.');
}

main()
  .then(() => db.destroy())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Platform migration failed:', err);
    db.destroy().finally(() => process.exit(1));
  });
