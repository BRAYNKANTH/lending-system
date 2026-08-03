import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';

export async function GET(request) {
  try {
    requireAuth(request, ['admin', 'agent']);
    const borrowers = await db('users').where({ role: 'borrower', is_active: true }).select('id', 'name', 'email', 'phone');
    return NextResponse.json(borrowers);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: 'Failed to fetch borrowers.' }, { status: 500 });
  }
}
