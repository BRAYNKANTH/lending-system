import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { recordPaymentCollection, recordFlatInstallmentCollection } from '@/lib/services/ledger.js';
import { notifyPaymentReceived } from '@/lib/services/notification.js';
import { validateImageDataUrl } from '@/lib/services/image.js';

// Record payment collection (Agent or Admin — borrowers have no login access)
export async function POST(request) {
  try {
    const authUser = await requireAuth(request, ['agent', 'admin', 'borrower']);
    const { loan_id, amount, payment_type, notes, proof_image_url, payment_method, idempotency_key, payment_date } = await request.json();

    if (!loan_id || !amount || !idempotency_key) {
      return NextResponse.json({ message: 'Loan ID, payment amount, and idempotency key are required.' }, { status: 400 });
    }
    if (!['interest', 'principal', 'flat_installment'].includes(payment_type)) {
      return NextResponse.json({ message: "Payment type is required and must be 'interest', 'principal', or 'flat_installment'." }, { status: 400 });
    }

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return NextResponse.json({ message: 'Amount must be a positive number.' }, { status: 400 });
    }

    // Optional backdating — lets an agent log a collection under the day it
    // actually happened (e.g. entering yesterday's round this morning)
    // instead of always stamping "now". Omit it entirely to keep the
    // default (payment_date = now, set at insert time).
    let parsedPaymentDate;
    if (payment_date) {
      const candidate = new Date(payment_date);
      if (isNaN(candidate.getTime())) {
        return NextResponse.json({ message: 'Payment date is invalid.' }, { status: 400 });
      }
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
      if (candidate > oneHourFromNow) {
        return NextResponse.json({ message: 'Payment date cannot be in the future.' }, { status: 400 });
      }
      parsedPaymentDate = candidate;
    }

    const existingTx = await db('transactions').where({ idempotency_key }).first();
    if (existingTx) {
      return NextResponse.json(
        { message: 'This payment has already been recorded (Duplicate transaction detected).', transaction: existingTx },
        { status: 409 }
      );
    }

    const loan = await db('loans').where({ id: loan_id }).first();
    if (!loan) {
      return NextResponse.json({ message: 'Loan not found.' }, { status: 404 });
    }

    // Role-based access checks
    if (authUser.role === 'agent' && loan.assigned_agent_id !== authUser.id) {
      return NextResponse.json({ message: 'This loan is not assigned to you.' }, { status: 403 });
    }
    if (authUser.role === 'borrower' && loan.borrower_id !== authUser.id) {
      return NextResponse.json({ message: 'This loan does not belong to you.' }, { status: 403 });
    }

    const agentId = authUser.role === 'borrower'
      ? (loan.assigned_agent_id || loan.lender_id)
      : authUser.id;

    let savedProofUrl = null;
    if (proof_image_url) {
      savedProofUrl = validateImageDataUrl(proof_image_url);
    }

    const collectFn = payment_type === 'flat_installment' ? recordFlatInstallmentCollection : recordPaymentCollection;
    const result = await collectFn({
      loanId: loan_id,
      agentId,
      amount: payAmount,
      paymentType: payment_type,
      notes,
      proofImageUrl: savedProofUrl,
      paymentMethod: payment_method || 'cash',
      idempotencyKey: idempotency_key,
      paymentDate: parsedPaymentDate
    });

    notifyPaymentReceived({
      borrower: result.borrower,
      admin: result.admin,
      agent: result.agent,
      amount: result.amount,
      paymentType: result.paymentType,
      interestType: result.interestType,
      principalOutstanding: result.newPrincipalOutstanding,
      interestBalance: result.newInterestBalance
    }).catch((err) => console.error('Notification failed:', err));

    const detailedTx = await db('transactions')
      .join('loans', 'transactions.loan_id', 'loans.id')
      .join('users as borrowers', 'transactions.borrower_id', 'borrowers.id')
      .join('users as agents', 'transactions.agent_id', 'agents.id')
      .select(
        'transactions.*',
        'borrowers.name as borrower_name',
        'borrowers.phone as borrower_phone',
        'borrowers.email as borrower_email',
        'agents.name as agent_name',
        'loans.principal_amount as loan_principal',
        'loans.interest_rate as loan_interest_rate',
        'loans.interest_type as loan_interest_type',
        'loans.principal_outstanding as loan_principal_outstanding',
        'loans.interest_balance as loan_interest_balance',
        'loans.status as loan_status'
      )
      .where('transactions.id', result.transactionId)
      .first();

    return NextResponse.json({
      message: 'Payment collection recorded and posted to ledger.',
      transactionId: result.transactionId,
      newPrincipalOutstanding: result.newPrincipalOutstanding,
      newInterestBalance: result.newInterestBalance,
      status: result.status,
      transaction: detailedTx
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Payment collection error:', error);
    if (error.message?.includes('exceeds outstanding') || error.message?.includes('exceeds the total outstanding') || error.message?.includes('already been fully paid') || error.message?.includes('defaulted') || error.message?.includes('written off') || error.message?.includes('awaiting admin approval') || error.message?.includes('was rejected') || error.message?.includes("must be 'interest' or 'principal'") || error.message?.includes('not a flat installment loan')) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Internal server error while processing payment.' }, { status: 500 });
  }
}
