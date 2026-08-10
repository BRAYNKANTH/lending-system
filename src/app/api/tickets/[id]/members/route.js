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
    const members = await db('ticket_members').where({ ticket_id: id }).orderBy('name', 'asc');
    return NextResponse.json(members);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('List ticket members error:', error);
    return NextResponse.json({ message: 'Failed to fetch ticket members.' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const user = await requireAuth(request, ['admin']);
    if (!user.ticket_access) {
      return NextResponse.json({ message: 'Forbidden. You do not have access to the Ticket system.' }, { status: 403 });
    }

    const { id } = params;
    const { name, phone } = await request.json();

    if (!name) {
      return NextResponse.json({ message: 'Member name is required.' }, { status: 400 });
    }

    // Check if member limit is already reached
    const ticket = await db('tickets').where({ id }).first();
    if (!ticket) {
      return NextResponse.json({ message: 'Ticket group not found.' }, { status: 404 });
    }

    const [{ count }] = await db('ticket_members').where({ ticket_id: id }).count('id as count');
    if (parseInt(count, 10) >= ticket.member_count) {
      return NextResponse.json({ message: `Cannot add member. Group member limit of ${ticket.member_count} reached.` }, { status: 400 });
    }

    const [member] = await db('ticket_members').insert({
      ticket_id: id,
      name: name.trim(),
      phone: phone ? phone.trim() : null
    }).returning('*');

    await db('audit_logs').insert({
      actor_id: user.id,
      action_type: 'TICKET_MEMBER_ADD',
      description: `Added member '${name}' to ticket group '${ticket.name}'.`
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Add ticket member error:', error);
    return NextResponse.json({ message: 'Failed to add member.' }, { status: 500 });
  }
}
