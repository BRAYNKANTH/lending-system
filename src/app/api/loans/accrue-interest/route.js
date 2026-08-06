import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { runInterestAccruals } from '@/lib/services/interest.js';

// Admin-only manual trigger to force-accrue interest for testing/demonstration
export async function POST(request) {
  try {
    await requireAuth(request, ['admin']);
    const results = await runInterestAccruals();
    return NextResponse.json({ message: 'Manual interest accrual process completed.', results });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Manual interest accrual error:', error);
    return NextResponse.json({ message: 'Interest accrual engine execution failed.' }, { status: 500 });
  }
}
