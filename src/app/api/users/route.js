import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';

// List all users (Admin only), optionally filtered by role
export async function GET(request) {
  try {
    requireAuth(request, ['admin']);
    const role = request.nextUrl.searchParams.get('role');

    let query = db('users').select('id', 'name', 'email', 'phone', 'role', 'is_active', 'must_change_password', 'created_at');
    if (role) query = query.where({ role });

    const users = await query.orderBy('created_at', 'desc');
    return NextResponse.json(users);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('List users error:', error);
    return NextResponse.json({ message: 'Failed to fetch users.' }, { status: 500 });
  }
}
