import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { generateTempPassword } from '@/lib/tempPassword.js';

// Admin-triggered password reset for any user
export async function POST(request, { params }) {
  try {
    const authUser = requireAuth(request, ['admin']);
    const { id } = params;

    const targetUser = await db('users').where({ id }).first();
    if (!targetUser) {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }

    const tempPassword = generateTempPassword();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    await db('users').where({ id }).update({
      password_hash: passwordHash,
      must_change_password: true,
      failed_login_attempts: 0,
      locked_until: null,
      updated_at: db.fn.now()
    });

    await db('audit_logs').insert({
      actor_id: authUser.id,
      action_type: 'RESET_PASSWORD',
      description: `Admin reset the password for user '${targetUser.name}' (${targetUser.role}).`
    });

    return NextResponse.json({
      message: 'Password reset successfully. Share the temporary password with the user securely.',
      temporaryPassword: tempPassword
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Reset password error:', error);
    return NextResponse.json({ message: 'Internal server error while resetting password.' }, { status: 500 });
  }
}
