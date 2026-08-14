import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db.js';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit.js';
import { normalizePhone } from '@/lib/phone.js';
import { logError } from '@/lib/logger.js';

const MAX_OTP_ATTEMPTS = 5;

// Self-service password reset, step 2 of 2 — verifies the OTP sent by
// /api/auth/forgot-password and sets the caller's own new password in one
// request. No auth token required (same as step 1 — this whole flow exists
// for people who can't log in), so both the OTP and the account's identity
// are re-checked here from scratch rather than trusting anything client-side.
export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const { limited } = checkRateLimit(`reset-password:${ip}`, { windowMs: 15 * 60 * 1000, max: 15 });
    if (limited) {
      return NextResponse.json({ message: 'Too many attempts from this network. Please wait 15 minutes and try again.' }, { status: 429 });
    }

    const { identifier, otp, new_password } = await request.json();
    if (!identifier || !identifier.trim()) {
      return NextResponse.json({ message: 'Phone number is required.' }, { status: 400 });
    }
    if (!otp || !otp.trim()) {
      return NextResponse.json({ message: 'Verification code is required.' }, { status: 400 });
    }
    if (!new_password || new_password.length < 6) {
      return NextResponse.json({ message: 'New password must be at least 6 characters long.' }, { status: 400 });
    }

    const normalized = normalizePhone(identifier);
    const user = normalized.length >= 9
      ? await db('users').whereRaw('phone LIKE ?', [`%${normalized}`]).first()
      : null;

    // Same generic-failure message whether the account doesn't exist, the
    // code is wrong, or it's expired — no reason to tell an attacker which
    // one it was.
    const genericError = 'Invalid or expired verification code. Please request a new one.';

    if (!user || !user.is_active || user.role === 'borrower' || !user.reset_otp_hash) {
      return NextResponse.json({ message: genericError }, { status: 400 });
    }
    if (!user.reset_otp_expires_at || new Date(user.reset_otp_expires_at) < new Date()) {
      return NextResponse.json({ message: genericError }, { status: 400 });
    }
    if (user.reset_otp_attempts >= MAX_OTP_ATTEMPTS) {
      return NextResponse.json({ message: 'Too many incorrect attempts. Please request a new code.' }, { status: 400 });
    }

    const otpMatches = await bcrypt.compare(otp.trim(), user.reset_otp_hash);
    if (!otpMatches) {
      await db('users').where({ id: user.id }).update({ reset_otp_attempts: user.reset_otp_attempts + 1 });
      return NextResponse.json({ message: genericError }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(new_password, salt);

    await db('users').where({ id: user.id }).update({
      password_hash: passwordHash,
      must_change_password: false,
      failed_login_attempts: 0,
      locked_until: null,
      reset_otp_hash: null,
      reset_otp_expires_at: null,
      reset_otp_attempts: 0,
      reset_otp_last_sent_at: null,
      updated_at: db.fn.now()
    });

    await db('audit_logs').insert({
      actor_id: user.id,
      action_type: 'PASSWORD_RESET_VIA_OTP',
      description: `User '${user.name}' reset their own password via OTP verification.`
    });

    return NextResponse.json({ message: 'Password updated. You can now log in with your new password.' });
  } catch (error) {
    logError('Reset password error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Internal server error while resetting your password.' }, { status: 500 });
  }
}
