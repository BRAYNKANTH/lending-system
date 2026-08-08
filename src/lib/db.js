import knexFactory from 'knex';

// Next.js reloads modules on every hot-reload in dev, can spin up a fresh
// serverless instance per request in production, and also imports every
// route module at build time to collect page data. Caching the client on
// globalThis avoids leaking a new connection pool on every reload/invocation,
// and deferring creation behind a Proxy means merely importing this module
// (e.g. during that build-time collection pass) never requires DATABASE_URL
// to be set — only an actual query does.
const globalForDb = globalThis;

function createClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Add it to .env.local (see .env.local.example).');
  }

  return knexFactory({
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    // min: 0 meant the pool dropped to zero idle connections during any
    // natural gap between requests (very normal — a user reading a page
    // before clicking the next thing). The next query then had to pay a
    // fresh TCP+TLS handshake to Supabase before it could even run —
    // measured at ~1.2s round-trip to this project's ap-northeast-1
    // (Tokyo) region — on top of the query itself. Keeping a couple of
    // connections always warm (min: 2) eliminates that reconnect tax for
    // normal usage patterns; Supabase's transaction pooler is built to
    // handle many such idle-but-held connections cheaply.
    pool: { min: 2, max: 15, idleTimeoutMillis: 60000 }
  });
}

function getClient() {
  if (!globalForDb.__lendDb) {
    globalForDb.__lendDb = createClient();
  }
  return globalForDb.__lendDb;
}

// A knex instance is itself a callable function (db('table')) that also
// carries properties (db.schema, db.transaction, db.fn, ...) — proxy both
// call and property access through to the lazily-created real client.
const db = new Proxy(function lendDbPlaceholder() {}, {
  apply(_target, thisArg, args) {
    return Reflect.apply(getClient(), thisArg, args);
  },
  get(_target, prop) {
    return getClient()[prop];
  }
});

export default db;
