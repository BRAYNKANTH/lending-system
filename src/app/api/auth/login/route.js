import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '@/lib/db.js';
import { JWT_SECRET } from '@/lib/jwt.js';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit.js';
import { normalizePhone } from '@/lib/phone.js';

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const { limited, retryAfterMs } = checkRateLimit(`login:${ip}`, { windowMs: 15 * 60 * 1000, max: 10 });
    if (limited) {
      return NextResponse.json(
        { message: 'Too many login attempts from this network. Please wait 15 minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      );
    }

    const { phone, password } = await request.json();

    if (!phone || !password) {
      return NextResponse.json({ message: 'Phone number and password are required.' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);
    if (normalized.length < 9) {
      return NextResponse.json({ message: 'Invalid phone number.' }, { status: 400 });
    }

    // Phone numbers are stored as typed (with or without +94/leading 0), so
    // match on the last 9 significant digits rather than requiring an exact
    // string match.
    const user = await db('users').whereRaw('phone LIKE ?', [`%${normalized}`]).first();
    if (!user || !user.is_active) {
      return NextResponse.json({ message: 'Invalid phone number or inactive account.' }, { status: 401 });
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return NextResponse.json(
        { message: `Account temporarily locked due to repeated failed logins. Try again in ${minutesLeft} minute(s).` },
        { status: 423 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const update = { failed_login_attempts: attempts };
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        update.locked_until = new Date(Date.now() + LOGIN_LOCKOUT_MS);
        update.failed_login_attempts = 0;
      }
      await db('users').where({ id: user.id }).update(update);

      if (update.locked_until) {
        return NextResponse.json({ message: 'Too many failed login attempts. Account locked for 15 minutes.' }, { status: 423 });
      }
      return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
    }

    if (user.failed_login_attempts || user.locked_until) {
      await db('users').where({ id: user.id }).update({ failed_login_attempts: 0, locked_until: null });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await db('audit_logs').insert({
      actor_id: user.id,
      action_type: 'USER_LOGIN',
      description: `User '${user.name}' logged in successfully.`
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        phone: user.phone,
        mustChangePassword: !!user.must_change_password
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Internal server error during login.' }, { status: 500 });
  }
}
