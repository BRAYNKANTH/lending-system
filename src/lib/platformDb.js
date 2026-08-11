import knexFactory from 'knex';

// Separate Knex client for the PLATFORM database — the master-admin control
// plane that tracks the roster of client organizations (name, branding,
// contact info, and each org's own Supabase connection string). This is
// deliberately a completely separate database from any tenant org's own
// data: every organization gets its own isolated Supabase project (see
// scripts/migrate-platform.js and the platform-admin onboarding flow), so a
// bug here can never leak one org's loan/borrower data to another. Mirrors
// src/lib/db.js's lazy-proxy pattern — see that file for the reasoning.
const globalForPlatformDb = globalThis;

function createClient() {
  if (!process.env.PLATFORM_DATABASE_URL) {
    throw new Error('PLATFORM_DATABASE_URL is not set. Add it to .env.local (see .env.local.example) — this is the connection string for the dedicated platform/control-plane Supabase project, separate from any tenant org\'s DATABASE_URL.');
  }

  return knexFactory({
    client: 'pg',
    connection: {
      connectionString: process.env.PLATFORM_DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    pool: { min: 1, max: 5, idleTimeoutMillis: 60000 }
  });
}

function getClient() {
  if (!globalForPlatformDb.__platformDb) {
    globalForPlatformDb.__platformDb = createClient();
  }
  return globalForPlatformDb.__platformDb;
}

const platformDb = new Proxy(function platformDbPlaceholder() {}, {
  apply(_target, thisArg, args) {
    return Reflect.apply(getClient(), thisArg, args);
  },
  get(_target, prop) {
    return getClient()[prop];
  }
});

export default platformDb;
