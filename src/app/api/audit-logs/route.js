import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { logError } from '@/lib/logger.js';

// Full, paginated audit trail (Admin only). Every mutating action in the
// app already writes to audit_logs — this is the first way to actually
// browse that history; previously only the 10 most recent entries were
// fetched (for the admin dashboard) and even those were never rendered.
export async function GET(request) {
  try {
    await requireAuth(request, ['admin']);
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit'), 10) || 25));
    const actionType = request.nextUrl.searchParams.get('actionType');
    const actorId = request.nextUrl.searchParams.get('actorId');
    const search = request.nextUrl.searchParams.get('search');
    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');

    let query = db('audit_logs').leftJoin('users', 'audit_logs.actor_id', 'users.id');
    if (actionType) query = query.where('audit_logs.action_type', actionType);
    if (actorId) query = query.where('audit_logs.actor_id', actorId);
    if (from) query = query.where('audit_logs.created_at', '>=', new Date(from));
    if (to) {
      const endTo = new Date(to);
      endTo.setHours(23, 59, 59, 999);
      query = query.where('audit_logs.created_at', '<=', endTo);
    }
    if (search) query = query.whereILike('audit_logs.description', `%${search}%`);

    const countResult = await query.clone().count('audit_logs.id as count').first();
    const total = parseInt(countResult.count, 10) || 0;

    const logs = await query.clone()
      .select('audit_logs.*', 'users.name as actor_name', 'users.role as actor_role')
      .orderBy('audit_logs.created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    const actionTypes = await db('audit_logs').distinct('action_type').orderBy('action_type');

    return NextResponse.json({
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      actionTypes: actionTypes.map((r) => r.action_type)
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Fetch audit logs error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Failed to fetch audit logs.' }, { status: 500 });
  }
}
