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
    pool: { min: 0, max: 5 }
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
