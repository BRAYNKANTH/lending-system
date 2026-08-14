import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { logError } from '@/lib/logger.js';

// Assign a winner to an already-run round — for when the round's bid was
// recorded before the winner was actually decided (e.g. logging the
// auction result on the day, but the physical draw/decision happens
// later). Only fills in winner_member_id; the round's actual money math
// (winner_payout, base_payment, host_fee_per_member, amount_per_member)
// was already fixed at the bid amount when the round was first run and
// isn't touched here — who receives the payout doesn't change what that
// payout amount is.
export async function PATCH(request, { params }) {
  try {
    const user = await requireAuth(request, ['admin']);
    if (!user.ticket_access) {
      return NextResponse.json({ message: 'Forbidden. You do not have access to the Ticket system.' }, { status: 403 });
    }

    const { id, auctionId } = params;
    const { winner_member_id } = await request.json();

    if (!winner_member_id) {
      return NextResponse.json({ message: 'A winner member ID is required.' }, { status: 400 });
    }

    const auction = await db('ticket_auctions').where({ id: auctionId, ticket_id: id }).first();
    if (!auction) {
      return NextResponse.json({ message: 'Auction round not found.' }, { status: 404 });
    }
    if (auction.winner_member_id) {
      return NextResponse.json({ message: 'This round already has a winner assigned.' }, { status: 400 });
    }

    const member = await db('ticket_members').where({ id: winner_member_id, ticket_id: id }).first();
    if (!member) {
      return NextResponse.json({ message: 'Member not found in this ticket group.' }, { status: 400 });
    }

    // Same rule the "Round Winner" dropdown already enforces at creation
    // time — each member wins exactly once across the group's lifetime.
    const alreadyWon = await db('ticket_auctions').where({ ticket_id: id, winner_member_id }).first();
    if (alreadyWon) {
      return NextResponse.json({ message: `${member.name} has already won round ${alreadyWon.round_number}.` }, { status: 400 });
    }

    const [updated] = await db('ticket_auctions').where({ id: auctionId }).update({ winner_member_id }).returning('*');

    await db('audit_logs').insert({
      actor_id: user.id,
      action_type: 'TICKET_AUCTION_WINNER_ASSIGNED',
      description: `Assigned ${member.name} as the winner of round ${auction.round_number} (previously recorded with no winner).`
    });

    return NextResponse.json({ ...updated, winner_name: member.name });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Assign auction winner error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Failed to assign winner.' }, { status: 500 });
  }
}
