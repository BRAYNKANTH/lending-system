import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';

// Permanently delete a user (Admin only). Blocked if the user has any
// loan/transaction/remittance history — that history is part of the audit
// trail and the ledger, so it can't be deleted out from under it. Use
// deactivate (PATCH /status) for users who've been active in the system;
// this is only for removing accounts that were never really used.
export async function DELETE(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin']);
    const { id } = params;

    if (id === authUser.id) {
      return NextResponse.json({ message: 'You cannot delete your own account.' }, { status: 400 });
    }

    const targetUser = await db('users').where({ id }).first();
    if (!targetUser) {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }

    const [loanCount, transactionCount, remittanceCount] = await Promise.all([
      db('loans').where({ borrower_id: id }).orWhere({ lender_id: id }).orWhere({ assigned_agent_id: id }).count('id as count').first(),
      db('transactions').where({ agent_id: id }).orWhere({ borrower_id: id }).count('id as count').first(),
      db('remittances').where({ agent_id: id }).count('id as count').first()
    ]);

    const hasHistory = parseInt(loanCount.count, 10) > 0 || parseInt(transactionCount.count, 10) > 0 || parseInt(remittanceCount.count, 10) > 0;
    if (hasHistory) {
      return NextResponse.json(
        { message: `${targetUser.name} has existing loan/payment history and can't be deleted — deactivate the account instead to preserve the audit trail.` },
        { status: 400 }
      );
    }

    await db('users').where({ id }).delete();

    await db('audit_logs').insert({
      actor_id: authUser.id,
      action_type: 'USER_DELETED',
      description: `Admin permanently deleted user '${targetUser.name}' (${targetUser.role}), who had no loan/payment history.`
    });

    return NextResponse.json({ message: `${targetUser.name} deleted.` });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Delete user error:', error);
    return NextResponse.json({ message: 'Failed to delete user.' }, { status: 500 });
  }
}
