import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { logError } from '@/lib/logger.js';

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
    logError('Get ticket error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Failed to fetch ticket details.' }, { status: 500 });
  }
}

// Permanently delete a ticket group — unlike loans (which deliberately
// block deleting anything with payment history via ON DELETE RESTRICT),
// tickets/members/auctions/payments are wired with ON DELETE CASCADE, so
// this genuinely removes the whole group's history: every member, every
// round's auction record, every payment-tracking row. That's an
// intentional, real capability here (e.g. a group created by mistake, or
// test data), not an oversight — but it's permanent, so the frontend
// requires typing the group's name to confirm before calling this.
export async function DELETE(request, { params }) {
  try {
    const user = await requireAuth(request, ['admin']);
    if (!user.ticket_access) {
      return NextResponse.json({ message: 'Forbidden. You do not have access to the Ticket system.' }, { status: 403 });
    }

    const { id } = params;
    const ticket = await db('tickets').where({ id }).first();
    if (!ticket) {
      return NextResponse.json({ message: 'Ticket group not found.' }, { status: 404 });
    }

    const [{ count: memberCount }] = await db('ticket_members').where({ ticket_id: id }).count('id as count');
    const [{ count: auctionCount }] = await db('ticket_auctions').where({ ticket_id: id }).count('id as count');

    await db('tickets').where({ id }).del();

    await db('audit_logs').insert({
      actor_id: user.id,
      action_type: 'TICKET_DELETE',
      description: `Permanently deleted ticket group '${ticket.name}' (${memberCount} member(s), ${auctionCount} round(s) of history removed).`
    });

    return NextResponse.json({ message: `'${ticket.name}' deleted.` });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Delete ticket error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Failed to delete ticket group.' }, { status: 500 });
  }
}

// Increase a group's member count mid-cycle — a real chit-fund scenario:
// someone new wants in after a few rounds have already run. Deliberately
// increase-only (never shrink): total_rounds is directly tied to
// member_count (see the isLastRound check in the auctions route — one
// round per member, always), so growing it just means more rounds get
// added onto the end, while every already-run round's recorded amounts
// stay exactly as they were (never retroactively recalculated — those
// collections already happened at the old per-member split). Shrinking
// would mean deciding which already-added member to remove and what
// happens to rounds already run against the old, larger count — real
// enough edge cases that it's not supported here; deleting members further
// down covers the 'added someone by mistake' case instead.
export async function PATCH(request, { params }) {
  try {
    const user = await requireAuth(request, ['admin']);
    if (!user.ticket_access) {
      return NextResponse.json({ message: 'Forbidden. You do not have access to the Ticket system.' }, { status: 403 });
    }

    const { id } = params;
    const { member_count } = await request.json();

    const ticket = await db('tickets').where({ id }).first();
    if (!ticket) {
      return NextResponse.json({ message: 'Ticket group not found.' }, { status: 404 });
    }

    if (member_count === undefined) {
      return NextResponse.json({ message: 'Nothing to update.' }, { status: 400 });
    }

    const newCount = parseInt(member_count, 10);
    if (isNaN(newCount) || newCount <= 0) {
      return NextResponse.json({ message: 'Member count must be a positive number.' }, { status: 400 });
    }
    if (newCount <= ticket.member_count) {
      return NextResponse.json({ message: `Member count can only be increased — it's currently ${ticket.member_count}. Removing members isn't supported here since rounds already run against the old count can't be undone; remove the individual member instead if one was added by mistake.` }, { status: 400 });
    }

    // Adding a round back onto a group that already finished its last
    // round (current_round reached the old member_count and status
    // flipped to 'completed') — now there's a genuine extra round to run,
    // so it goes back to active.
    const shouldReactivate = ticket.status === 'completed' && newCount > ticket.current_round;

    const [updated] = await db('tickets')
      .where({ id })
      .update({
        member_count: newCount,
        ...(shouldReactivate ? { status: 'active' } : {})
      })
      .returning('*');

    await db('audit_logs').insert({
      actor_id: user.id,
      action_type: 'TICKET_MEMBER_COUNT_UPDATE',
      description: `Increased member count for ticket group '${ticket.name}' from ${ticket.member_count} to ${newCount}${shouldReactivate ? ' (reopened for an additional round)' : ''}.`
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Update ticket error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Failed to update ticket group.' }, { status: 500 });
  }
}
