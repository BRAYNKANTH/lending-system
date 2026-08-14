import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { stripIntakeMediaList } from '@/lib/stripMedia.js';
import { logError } from '@/lib/logger.js';

// List borrower-intake submissions (Admin/Agent) — the review queue for
// /apply submissions. Defaults to pending only; ?status=all returns
// everything including already-converted/dismissed ones for reference.
export async function GET(request) {
  try {
    await requireAuth(request, ['admin', 'agent']);
    const status = request.nextUrl.searchParams.get('status') || 'pending';

    let query = db('borrower_intakes').orderBy('created_at', 'desc');
    if (status !== 'all') query = query.where({ status });

    const intakes = await query;
    return NextResponse.json(stripIntakeMediaList(intakes));
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Fetch borrower intakes error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Failed to fetch borrower intake submissions.' }, { status: 500 });
  }
}
