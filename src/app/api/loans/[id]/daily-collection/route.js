import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { recordPaymentCollection } from '@/lib/services/ledger.js';
import { notifyPaymentReceived, notifyMissedPayment } from '@/lib/services/notification.js';
import { logError } from '@/lib/logger.js';

// Mark a single day's collection status for a loan — mirrors the physical
// passbook (did the borrower pay today or not). 'paid'/'partial' actually
// records a real interest payment (through the same path as the normal
// payment form) so the log stays consistent with the ledger; 'not_paid' is
// just a log entry, no money moves.
export async function POST(request, { params }) {
  try {
    const authUser = await requireAuth(request, ['admin', 'agent']);
    const { id: loanId } = params;
    const { date, status, amount, notes } = await request.json();

    if (!['paid', 'partial', 'not_paid'].includes(status)) {
      return NextResponse.json({ message: "Status must be 'paid', 'partial', or 'not_paid'." }, { status: 400 });
    }

    const collectionDate = date ? new Date(date) : new Date();
    if (isNaN(collectionDate.getTime())) {
      return NextResponse.json({ message: 'Invalid date.' }, { status: 400 });
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (collectionDate > today) {
      return NextResponse.json({ message: 'Cannot mark a future date.' }, { status: 400 });
    }
    const dateStr = collectionDate.toISOString().slice(0, 10);

    const loan = await db('loans').where({ id: loanId }).first();
    if (!loan) {
      return NextResponse.json({ message: 'Loan not found.' }, { status: 404 });
    }
    if (authUser.role === 'agent' && loan.assigned_agent_id !== authUser.id) {
      return NextResponse.json({ message: 'This loan is not assigned to you.' }, { status: 403 });
    }

    let transactionId = null;
    let paymentResult = null;

    if (status === 'paid' || status === 'partial') {
      const payAmount = parseFloat(amount);
      if (isNaN(payAmount) || payAmount <= 0) {
        return NextResponse.json({ message: 'A positive amount is required to mark a day as paid or partially paid.' }, { status: 400 });
      }

      try {
        paymentResult = await recordPaymentCollection({
          loanId,
          agentId: authUser.id,
          amount: payAmount,
          paymentType: 'interest',
          notes: notes || `Daily collection for ${dateStr}`,
          idempotencyKey: `daily_${loanId}_${dateStr}_${crypto.randomBytes(4).toString('hex')}`
        });
      } catch (err) {
        return NextResponse.json({ message: err.message }, { status: 400 });
      }
      transactionId = paymentResult.transactionId;

      notifyPaymentReceived({
        borrower: paymentResult.borrower,
        admin: paymentResult.admin,
        amount: paymentResult.amount,
        paymentType: 'interest',
        interestType: loan.interest_type,
        principalOutstanding: paymentResult.newPrincipalOutstanding,
        interestBalance: paymentResult.newInterestBalance
      }).catch((err) => logError('Notification failed', err, { method: request.method, url: request.url }));
    }

    if (status === 'not_paid') {
      const borrower = await db('users').where({ id: loan.borrower_id }).first();
      const admin = await db('users').where({ id: loan.lender_id }).first();
      notifyMissedPayment({ borrower, admin, collectionDate: dateStr })
        .catch((err) => logError('Notification failed', err, { method: request.method, url: request.url }));
    }

    const existing = await db('daily_collections').where({ loan_id: loanId, collection_date: dateStr }).first();
    let row;
    if (existing) {
      [row] = await db('daily_collections')
        .where({ id: existing.id })
        .update({
          status,
          amount: status === 'not_paid' ? null : parseFloat(amount),
          transaction_id: transactionId,
          marked_by: authUser.id,
          notes: notes || null
        })
        .returning('*');
    } else {
      [row] = await db('daily_collections')
        .insert({
          loan_id: loanId,
          collection_date: dateStr,
          status,
          amount: status === 'not_paid' ? null : parseFloat(amount),
          transaction_id: transactionId,
          marked_by: authUser.id,
          notes: notes || null
        })
        .returning('*');
    }

    await db('audit_logs').insert({
      actor_id: authUser.id,
      action_type: 'DAILY_COLLECTION_MARK',
      description: `Marked ${dateStr} as '${status}' for loan ID ${loanId}${transactionId ? ` (LKR ${parseFloat(amount).toLocaleString()} collected)` : ''}.`
    });

    return NextResponse.json({ message: 'Daily collection status saved.', dailyCollection: row, payment: paymentResult });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Daily collection mark error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Internal server error while marking daily collection.' }, { status: 500 });
  }
}
