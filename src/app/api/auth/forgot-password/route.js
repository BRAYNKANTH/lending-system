import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '@/lib/db.js';
import { notifyPasswordResetOtp } from '@/lib/services/notification.js';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit.js';
import { normalizePhone } from '@/lib/phone.js';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds between sends, same account

// Self-service password reset, step 1 of 2 — no auth required (that's the
// point). Sends a short-lived 6-digit OTP via SMS instead of a full
// temporary password: the old flow generated and texted a real, immediately
// usable password, which meant whoever received that SMS (or intercepted
// it) had full account access with nothing else required. An OTP only
// proves phone ownership — the user still has to choose their own new
// password in the same request that verifies it (see /api/auth/reset-password),
// so a leaked SMS alone can't be used to log in.
//
// Always returns the same generic message regardless of whether the
// account exists, so this can't be used to enumerate registered phone
// numbers. Doubles as the "Resend OTP" endpoint — calling it again just
// issues a fresh code, subject to the per-account cooldown below.
export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const { limited } = checkRateLimit(`forgot-password:${ip}`, { windowMs: 15 * 60 * 1000, max: 8 });
    if (limited) {
      return NextResponse.json({ message: 'Too many reset requests from this network. Please wait 15 minutes and try again.' }, { status: 429 });
    }

    const { identifier } = await request.json();
    if (!identifier || !identifier.trim()) {
      return NextResponse.json({ message: 'Please enter your registered phone number.' }, { status: 400 });
    }

    const normalized = normalizePhone(identifier);
    const user = normalized.length >= 9
      ? await db('users').whereRaw('phone LIKE ?', [`%${normalized}`]).first()
      : null;

    const genericMessage = 'If that account exists, a verification code has been sent to the registered mobile number.';
    // Borrowers have no login access, so there's nothing to reset — treated
    // the same as a non-existent account to avoid leaking which phone
    // numbers are registered as borrowers vs staff.
    if (!user || !user.is_active || user.role === 'borrower') {
      return NextResponse.json({ message: genericMessage });
    }

    // Per-account cooldown (on top of the per-IP rate limit above) so
    // "Resend OTP" can't be hammered to run up SMS costs or spam one
    // person's phone. Silently returns the generic success message rather
    // than an error — from the caller's point of view a too-soon resend
    // just looks like the first send again; the code already sent is still
    // valid.
    if (user.reset_otp_last_sent_at) {
      const elapsed = Date.now() - new Date(user.reset_otp_last_sent_at).getTime();
      if (elapsed < OTP_RESEND_COOLDOWN_MS) {
        return NextResponse.json({ message: genericMessage, cooldownMs: OTP_RESEND_COOLDOWN_MS - elapsed });
      }
    }

    const otp = crypto.randomInt(100000, 1000000).toString(); // 6 digits, zero-padded by range
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);

    await db('users').where({ id: user.id }).update({
      reset_otp_hash: otpHash,
      reset_otp_expires_at: new Date(Date.now() + OTP_TTL_MS),
      reset_otp_attempts: 0,
      reset_otp_last_sent_at: db.fn.now(),
      updated_at: db.fn.now()
    });

    await db('audit_logs').insert({
      actor_id: user.id,
      action_type: 'FORGOT_PASSWORD',
      description: `User '${user.name}' requested a password reset OTP.`
    });

    notifyPasswordResetOtp({ user, otp }).catch((err) => console.error('Failed to dispatch OTP notification:', err));

    return NextResponse.json({ message: genericMessage, cooldownMs: OTP_RESEND_COOLDOWN_MS });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ message: 'Internal server error while processing your request.' }, { status: 500 });
  }
}
