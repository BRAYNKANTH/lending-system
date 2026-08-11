import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import platformDb from '@/lib/platformDb.js';
import { PLATFORM_JWT_SECRET } from '@/lib/platformJwt.js';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit.js';

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// Login for the master-admin control plane — email + password, deliberately
// separate from the tenant app's phone-based login (src/app/api/auth/login).
// There is normally only a handful of these accounts (the platform owner
// and maybe a couple of ops staff), not per-organization users.
export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const { limited, retryAfterMs } = checkRateLimit(`platform-login:${ip}`, { windowMs: 15 * 60 * 1000, max: 10 });
    if (limited) {
      return NextResponse.json(
        { message: 'Too many login attempts from this network. Please wait 15 minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      );
    }

    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required.' }, { status: 400 });
    }

    const admin = await platformDb('platform_admins').whereRaw('LOWER(email) = LOWER(?)', [email.trim()]).first();
    if (!admin || !admin.is_active) {
      return NextResponse.json({ message: 'Invalid email or inactive account.' }, { status: 401 });
    }
    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(admin.locked_until) - new Date()) / 60000);
      return NextResponse.json(
        { message: `Account temporarily locked due to repeated failed logins. Try again in ${minutesLeft} minute(s).` },
        { status: 423 }
      );
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      const attempts = (admin.failed_login_attempts || 0) + 1;
      const update = { failed_login_attempts: attempts };
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        update.locked_until = new Date(Date.now() + LOGIN_LOCKOUT_MS);
        update.failed_login_attempts = 0;
      }
      await platformDb('platform_admins').where({ id: admin.id }).update(update);

      if (update.locked_until) {
        return NextResponse.json({ message: 'Too many failed login attempts. Account locked for 15 minutes.' }, { status: 423 });
      }
      return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
    }

    if (admin.failed_login_attempts || admin.locked_until) {
      await platformDb('platform_admins').where({ id: admin.id }).update({ failed_login_attempts: 0, locked_until: null });
    }

    const token = jwt.sign(
      { id: admin.id, name: admin.name, email: admin.email },
      PLATFORM_JWT_SECRET,
      { expiresIn: '24h' }
    );

    return NextResponse.json({
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email, mustChangePassword: !!admin.must_change_password }
    });
  } catch (error) {
    console.error('Platform login error:', error);
    return NextResponse.json({ message: 'Internal server error during login.' }, { status: 500 });
  }
}
