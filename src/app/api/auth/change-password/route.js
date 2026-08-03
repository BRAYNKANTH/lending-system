import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';

export async function POST(request) {
  try {
    const authUser = requireAuth(request);
    const { current_password, new_password } = await request.json();

    if (!current_password || !new_password) {
      return NextResponse.json({ message: 'Current password and new password are required.' }, { status: 400 });
    }
    if (new_password.length < 6) {
      return NextResponse.json({ message: 'New password must be at least 6 characters long.' }, { status: 400 });
    }

    const user = await db('users').where({ id: authUser.id }).first();
    if (!user) {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json({ message: 'Current password is incorrect.' }, { status: 401 });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(new_password, salt);

    await db('users').where({ id: user.id }).update({
      password_hash: passwordHash,
      must_change_password: false,
      updated_at: db.fn.now()
    });

    await db('audit_logs').insert({
      actor_id: user.id,
      action_type: 'CHANGE_PASSWORD',
      description: `User '${user.name}' changed their own password.`
    });

    return NextResponse.json({ message: 'Password updated successfully.' });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Change password error:', error);
    return NextResponse.json({ message: 'Internal server error while changing password.' }, { status: 500 });
  }
}
