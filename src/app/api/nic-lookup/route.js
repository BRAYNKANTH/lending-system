import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { logError } from '@/lib/logger.js';

// Live NIC lookup, called while an admin/agent is typing a borrower's or
// guarantor's NIC into the Give Loan wizard. Answers two questions the
// wizard needs before letting someone submit:
//   1. How many active/pending loans does this NIC already guarantee?
//      (backs the "max 3 active guarantees" rule enforced server-side in
//      /api/loans and /api/loans/[id]/guarantor — this just lets the UI
//      warn about it before submit instead of only after.)
//   2. Does this NIC have a defaulted loan on record, either as the
//      borrower or as a guarantor? ("Bad record" flag — deliberately
//      DEFAULTED only, not written_off: a write-off is the lender's own
//      accounting decision to stop chasing a debt, not proof the person
//      themselves is untrustworthy the way an active default is.)
export async function GET(request) {
  try {
    await requireAuth(request, ['admin', 'agent']);
    const nic = (request.nextUrl.searchParams.get('nic') || '').trim().toUpperCase();
    if (!nic) {
      return NextResponse.json({ message: 'NIC number is required.' }, { status: 400 });
    }

    const { count: activeGuaranteedLoansCount } = await db('guarantors')
      .join('loans', 'guarantors.loan_id', 'loans.id')
      .where('guarantors.nic_number', nic)
      .whereIn('loans.status', ['active', 'pending'])
      .countDistinct('guarantors.loan_id as count')
      .first();

    const defaultedAsBorrower = await db('loans')
      .where({ nic_number: nic, status: 'defaulted' })
      .select('id', 'reference_number', 'default_reason', 'defaulted_at');

    const defaultedAsGuarantor = await db('guarantors')
      .join('loans', 'guarantors.loan_id', 'loans.id')
      .where('guarantors.nic_number', nic)
      .where('loans.status', 'defaulted')
      .select('loans.id', 'loans.reference_number', 'loans.borrower_id', 'loans.default_reason', 'loans.defaulted_at');

    return NextResponse.json({
      nic,
      activeGuaranteedLoansCount: parseInt(activeGuaranteedLoansCount, 10),
      hasDefaultedHistory: defaultedAsBorrower.length > 0 || defaultedAsGuarantor.length > 0,
      defaultedAsBorrower,
      defaultedAsGuarantor
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('NIC lookup error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Failed to look up NIC.' }, { status: 500 });
  }
}
