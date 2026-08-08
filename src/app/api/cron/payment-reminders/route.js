import { NextResponse } from 'next/server';
import { runPaymentReminders } from '@/lib/services/reminders.js';

// One real SMS API call per loan with interest due, sent sequentially —
// slower per-iteration than a plain DB write, so this hits the same
// default-timeout risk as the accrual cron (see that file for details),
// only sooner as the loan book grows since network calls to Text.lk cost
// more than a local DB round-trip.
export const maxDuration = 60;

// Triggered by Vercel Cron (see vercel.json). Vercel automatically sends
// `Authorization: Bearer <CRON_SECRET>` on cron-triggered requests when the
// CRON_SECRET env var is set on the project.
export async function GET(request) {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const results = await runPaymentReminders();
    return NextResponse.json({ message: 'Scheduled payment reminders completed.', results });
  } catch (error) {
    console.error('Cron payment reminders error:', error);
    return NextResponse.json({ message: 'Payment reminder job execution failed.' }, { status: 500 });
  }
}
