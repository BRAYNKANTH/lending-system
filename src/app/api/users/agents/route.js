import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';

export async function GET(request) {
  try {
    requireAuth(request, ['admin']);
    const agents = await db('users').where({ role: 'agent', is_active: true }).select('id', 'name', 'email', 'phone');
    return NextResponse.json(agents);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: 'Failed to fetch agents.' }, { status: 500 });
  }
}
