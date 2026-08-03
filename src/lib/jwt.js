import crypto from 'crypto';

// Single source of truth for the JWT signing secret. A well-known hardcoded
// fallback would let anyone forge admin tokens, so when JWT_SECRET isn't
// configured we generate a random secret for this process instead (existing
// sessions just won't survive a restart, which is the safe failure mode).
const globalForJwt = globalThis;

function resolveSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  console.warn('\n⚠️  WARNING: JWT_SECRET is not set in the environment.');
  console.warn('⚠️  Generated a random secret for this process only — all tokens will be invalidated on restart.');
  console.warn('⚠️  Set JWT_SECRET in .env.local / Vercel env vars for stable, production-safe sessions.\n');
  return crypto.randomBytes(48).toString('hex');
}

export const JWT_SECRET = globalForJwt.__lendJwtSecret || (globalForJwt.__lendJwtSecret = resolveSecret());
