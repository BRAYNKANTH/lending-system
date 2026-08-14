import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { notifyPasswordResetOtp } from '@/lib/services/notification.js';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes — mirrors /api/auth/forgot-password

// Admin-triggered password reset for any user — sends the same kind of OTP
// the self-service "Forgot Password" flow uses, rather than generating a
// full temporary password the admin would see and have to relay themselves
// (that old behavior meant the admin briefly held a real, immediately
// usable credential for someone else's account, and if it wasn't relayed
// securely — e.g. read aloud, texted in plain chat — anyone who saw it had
// full access). Now the admin can only ask for a reset; they never see the
// code or a password. The target user finishes it themselves via "Forgot
// password?" on the login screen — same one-time-code-plus-their-own-new-
// password flow as if they'd requested it themselves — so only the account
// owner, from their own phone, can ever actually set that account's
// password.
export async function POST(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin']);
    const { id } = params;

    const targetUser = await db('users').where({ id }).first();
    if (!targetUser) {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }
    if (targetUser.role === 'borrower') {
      return NextResponse.json({ message: 'Borrowers have no login access, so there is no password to reset.' }, { status: 400 });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);

    await db('users').where({ id: targetUser.id }).update({
      reset_otp_hash: otpHash,
      reset_otp_expires_at: new Date(Date.now() + OTP_TTL_MS),
      reset_otp_attempts: 0,
      reset_otp_last_sent_at: db.fn.now(),
      failed_login_attempts: 0,
      locked_until: null,
      updated_at: db.fn.now()
    });

    await db('audit_logs').insert({
      actor_id: authUser.id,
      action_type: 'RESET_PASSWORD',
      description: `Admin sent a password reset verification code to user '${targetUser.name}' (${targetUser.role}).`
    });

    notifyPasswordResetOtp({ user: targetUser, otp }).catch((err) => console.error('Failed to dispatch OTP notification:', err));

    return NextResponse.json({
      message: `A verification code has been sent to ${targetUser.name}'s phone (${targetUser.phone}). They'll need to enter it via "Forgot password?" on the login screen to set a new password.`
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Reset password error:', error);
    return NextResponse.json({ message: 'Internal server error while resetting password.' }, { status: 500 });
  }
}
