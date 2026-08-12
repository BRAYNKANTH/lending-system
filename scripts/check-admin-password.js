// One-off check: does the given plaintext password match the stored hash
// for the admin account(s)? Prints only true/false per user — never the
// hash or any other credential.
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import knexFactory from 'knex';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const knex = knexFactory({
  client: 'pg',
  connection: { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
});

const CANDIDATE = process.argv[2] || 'password123';

(async () => {
  try {
    const admins = await knex('users').where({ role: 'admin' }).select('id', 'name', 'phone', 'is_active', 'password_hash');
    if (!admins.length) {
      console.log('No users with role=admin found.');
      return;
    }
    for (const u of admins) {
      const matches = await bcrypt.compare(CANDIDATE, u.password_hash);
      console.log(`admin id=${u.id} name="${u.name}" phone=${u.phone} active=${u.is_active} -> "${CANDIDATE}" matches: ${matches}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await knex.destroy();
  }
})();
