import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { logError } from '@/lib/logger.js';

// Full, paginated SMS delivery log (Admin only). Every sendNotification()
// call (OTP, loan/payment/reminder alerts) writes here with a real status
// — 'sent' (actually left the server via Text.lk), 'mocked' (Text.lk isn't
// configured for this org, nothing was sent), or 'failed' (Text.lk
// rejected it / the request errored). Exists so a misconfigured org
// (TEXTLK_API_TOKEN/TEXTLK_SENDER_ID missing) is visible in the app
// instead of only discoverable by reading server logs after a user
// reports a missing OTP.
export async function GET(request) {
  try {
    await requireAuth(request, ['admin']);
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit'), 10) || 25));
    const status = request.nextUrl.searchParams.get('status');
    const search = request.nextUrl.searchParams.get('search');
    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');

    let query = db('sms_logs');
    if (status) query = query.where('status', status);
    if (from) query = query.where('created_at', '>=', new Date(from));
    if (to) {
      const endTo = new Date(to);
      endTo.setHours(23, 59, 59, 999);
      query = query.where('created_at', '<=', endTo);
    }
    if (search) {
      query = query.where((builder) => {
        builder.whereILike('recipient_name', `%${search}%`).orWhereILike('phone', `%${search}%`);
      });
    }

    const countResult = await query.clone().count('id as count').first();
    const total = parseInt(countResult.count, 10) || 0;

    const logs = await query.clone()
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    const failedOrMockedLast24h = await db('sms_logs')
      .whereIn('status', ['failed', 'mocked'])
      .where('created_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .count('id as count')
      .first();

    return NextResponse.json({
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      failedOrMockedLast24h: parseInt(failedOrMockedLast24h.count, 10) || 0
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Fetch SMS logs error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Failed to fetch SMS logs.' }, { status: 500 });
  }
}
