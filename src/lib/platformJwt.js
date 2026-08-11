import crypto from 'crypto';

// Signing secret for platform-admin tokens — deliberately separate from the
// tenant app's JWT_SECRET (src/lib/jwt.js) so a token issued for one can
// never be replayed against the other, even if both env vars were somehow
// set to the same value by mistake on a shared deployment.
const globalForPlatformJwt = globalThis;

function resolveSecret() {
  if (process.env.PLATFORM_JWT_SECRET) return process.env.PLATFORM_JWT_SECRET;

  console.warn('\n⚠️  WARNING: PLATFORM_JWT_SECRET is not set in the environment.');
  console.warn('⚠️  Generated a random secret for this process only — all platform-admin sessions will be invalidated on restart.');
  console.warn('⚠️  Set PLATFORM_JWT_SECRET in .env.local / Vercel env vars for stable, production-safe sessions.\n');
  return crypto.randomBytes(48).toString('hex');
}

export const PLATFORM_JWT_SECRET = globalForPlatformJwt.__platformJwtSecret || (globalForPlatformJwt.__platformJwtSecret = resolveSecret());
