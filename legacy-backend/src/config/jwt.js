import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env here too (not just in app.js) since this module can be imported
// — via routes/controllers — before app.js's own dotenv.config() call runs.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Single source of truth for the JWT signing secret, shared by the login
// handler and the auth middleware. A well-known hardcoded fallback would let
// anyone forge admin tokens, so when JWT_SECRET isn't configured we generate
// a random secret for this process instead (existing sessions just won't
// survive a restart, which is the safe failure mode).
let secret = process.env.JWT_SECRET;

if (!secret) {
  secret = crypto.randomBytes(48).toString('hex');
  console.warn('\n⚠️  WARNING: JWT_SECRET is not set in the environment.');
  console.warn('⚠️  Generated a random secret for this process only — all tokens will be invalidated on restart.');
  console.warn('⚠️  Set JWT_SECRET in backend/.env for stable, production-safe sessions.\n');
}

export const JWT_SECRET = secret;
