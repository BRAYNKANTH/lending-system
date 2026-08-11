import jwt from 'jsonwebtoken';
import platformDb from './platformDb.js';
import { PLATFORM_JWT_SECRET } from './platformJwt.js';

export class PlatformAuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getAdminFromRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.split(' ')[1]; // "Bearer <token>"
  if (!token) return null;
  try {
    return jwt.verify(token, PLATFORM_JWT_SECRET);
  } catch {
    return null;
  }
}

// Verifies the request's platform-admin JWT and re-checks is_active against
// the database — same reasoning as requireAuth in src/lib/auth.js: the
// token alone doesn't reflect an account deactivated after it was issued.
// There's only one role in the platform DB (master admin), so unlike the
// tenant app's requireAuth there's no role list to check.
export async function requirePlatformAuth(request) {
  const tokenAdmin = getAdminFromRequest(request);
  if (!tokenAdmin) {
    throw new PlatformAuthError(401, 'Authentication token required or invalid/expired.');
  }

  const dbAdmin = await platformDb('platform_admins').where({ id: tokenAdmin.id }).select('id', 'name', 'email', 'is_active').first();
  if (!dbAdmin || !dbAdmin.is_active) {
    throw new PlatformAuthError(401, 'Account is inactive or no longer exists.');
  }

  return { id: dbAdmin.id, name: dbAdmin.name, email: dbAdmin.email };
}
