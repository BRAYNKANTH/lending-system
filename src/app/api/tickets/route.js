import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';

export async function GET(request) {
  try {
    const user = await requireAuth(request);
    if (!user.ticket_access) {
      return NextResponse.json({ message: 'Forbidden. You do not have access to the Ticket system.' }, { status: 403 });
    }

    const tickets = await db('tickets').orderBy('created_at', 'desc');
    return NextResponse.json(tickets);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('List tickets error:', error);
    return NextResponse.json({ message: 'Failed to fetch tickets.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await requireAuth(request, ['admin']);
    if (!user.ticket_access) {
      return NextResponse.json({ message: 'Forbidden. You do not have access to the Ticket system.' }, { status: 403 });
    }

    const { name, total_value, member_count, start_date, host_fee_type, host_fee_value } = await request.json();

    if (!name || !total_value || !member_count || !start_date || !host_fee_type || host_fee_value === undefined) {
      return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 });
    }

    const [ticket] = await db('tickets').insert({
      name: name.trim(),
      total_value: parseFloat(total_value),
      member_count: parseInt(member_count, 10),
      start_date,
      host_fee_type,
      host_fee_value: parseFloat(host_fee_value),
      current_round: 1,
      status: 'active'
    }).returning('*');

    await db('audit_logs').insert({
      actor_id: user.id,
      action_type: 'TICKET_CREATE',
      description: `Created ticket group '${name}' with total value ${total_value} LKR.`
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Create ticket error:', error);
    return NextResponse.json({ message: 'Failed to create ticket.' }, { status: 500 });
  }
}
