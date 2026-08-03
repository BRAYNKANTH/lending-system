import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './jwt.js';

export class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getUserFromRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.split(' ')[1]; // "Bearer <token>"
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Verifies the request's JWT and (optionally) checks the user's role.
// Throws AuthError on failure — route handlers should catch it and respond
// with { message } at err.status, matching the rest of the API's error shape.
export function requireAuth(request, allowedRoles = []) {
  const user = getUserFromRequest(request);
  if (!user) {
    throw new AuthError(401, 'Authentication token required or invalid/expired.');
  }
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    throw new AuthError(403, `Forbidden. This action requires one of these roles: [${allowedRoles.join(', ')}]. Your role: '${user.role}'`);
  }
  return user;
}
