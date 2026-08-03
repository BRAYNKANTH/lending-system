import { NextResponse } from 'next/server';
import { runInterestAccruals } from '@/lib/services/interest.js';

// Triggered by Vercel Cron (see vercel.json). Vercel automatically sends
// `Authorization: Bearer <CRON_SECRET>` on cron-triggered requests when the
// CRON_SECRET env var is set on the project, so this checks that instead of
// a user JWT — there's no logged-in user for a scheduled job to authenticate as.
export async function GET(request) {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const results = await runInterestAccruals();
    return NextResponse.json({ message: 'Scheduled interest accrual completed.', results });
  } catch (error) {
    console.error('Cron interest accrual error:', error);
    return NextResponse.json({ message: 'Interest accrual engine execution failed.' }, { status: 500 });
  }
}
