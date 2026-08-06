import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';

// Toggle a user's active status (Admin only)
export async function PATCH(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin']);
    const { id } = params;
    const { is_active } = await request.json();

    if (typeof is_active !== 'boolean') {
      return NextResponse.json({ message: 'is_active (boolean) is required.' }, { status: 400 });
    }
    if (id === authUser.id) {
      return NextResponse.json({ message: 'You cannot change your own active status.' }, { status: 400 });
    }

    const targetUser = await db('users').where({ id }).first();
    if (!targetUser) {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }

    await db('users').where({ id }).update({ is_active, updated_at: db.fn.now() });

    // A deactivated agent can no longer log in, so their active loans would
    // otherwise stay silently assigned to someone who can never collect on
    // them again. Unassign (not delete) so they fall back to admin
    // self-collect and show up for reassignment, instead of disappearing
    // from anyone's active workflow.
    let unassignedCount = 0;
    if (!is_active && targetUser.role === 'agent') {
      const unassigned = await db('loans')
        .where({ assigned_agent_id: id, status: 'active' })
        .update({ assigned_agent_id: null, updated_at: db.fn.now() })
        .returning('id');
      unassignedCount = unassigned.length;
    }

    await db('audit_logs').insert({
      actor_id: authUser.id,
      action_type: 'USER_STATUS_CHANGE',
      description: `Admin ${is_active ? 'activated' : 'deactivated'} user '${targetUser.name}' (${targetUser.role}).`
        + (unassignedCount > 0 ? ` Unassigned ${unassignedCount} active loan(s) back to self-collect.` : '')
    });

    return NextResponse.json({
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully.`
        + (unassignedCount > 0 ? ` ${unassignedCount} active loan(s) were unassigned and need to be reassigned to another agent.` : ''),
      unassignedLoanCount: unassignedCount
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Set user status error:', error);
    return NextResponse.json({ message: 'Failed to update user status.' }, { status: 500 });
  }
}
