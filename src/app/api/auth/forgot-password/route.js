import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db.js';
import { generateTempPassword } from '@/lib/tempPassword.js';
import { notifyPasswordReset } from '@/lib/services/notification.js';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit.js';
import { normalizePhone } from '@/lib/phone.js';

// Self-service password reset — no auth required (that's the point). Looks
// the user up by phone and, if found, sends a temporary password via the
// existing mock SMS/WhatsApp notification channel. Always returns the same
// generic message regardless of whether the account exists, so this can't
// be used to enumerate registered phone numbers.
export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const { limited } = checkRateLimit(`forgot-password:${ip}`, { windowMs: 15 * 60 * 1000, max: 5 });
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

    const genericMessage = 'If that account exists, a temporary password has been sent to the registered mobile number.';

    if (!user || !user.is_active) {
      return NextResponse.json({ message: genericMessage });
    }

    const tempPassword = generateTempPassword();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    await db('users').where({ id: user.id }).update({
      password_hash: passwordHash,
      must_change_password: true,
      failed_login_attempts: 0,
      locked_until: null,
      updated_at: db.fn.now()
    });

    await db('audit_logs').insert({
      actor_id: user.id,
      action_type: 'FORGOT_PASSWORD',
      description: `User '${user.name}' requested a self-service password reset.`
    });

    notifyPasswordReset({ user, tempPassword }).catch((err) => console.error('Failed to dispatch password reset notification:', err));

    return NextResponse.json({ message: genericMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ message: 'Internal server error while processing your request.' }, { status: 500 });
  }
}
