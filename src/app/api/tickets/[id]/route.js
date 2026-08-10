import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';

export async function GET(request, { params }) {
  try {
    const user = await requireAuth(request);
    if (!user.ticket_access) {
      return NextResponse.json({ message: 'Forbidden. You do not have access to the Ticket system.' }, { status: 403 });
    }

    const { id } = params;
    const ticket = await db('tickets').where({ id }).first();

    if (!ticket) {
      return NextResponse.json({ message: 'Ticket not found.' }, { status: 404 });
    }

    return NextResponse.json(ticket);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Get ticket error:', error);
    return NextResponse.json({ message: 'Failed to fetch ticket details.' }, { status: 500 });
  }
}
