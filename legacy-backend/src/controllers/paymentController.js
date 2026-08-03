import { recordPaymentCollection } from '../services/ledger.js';
import { notifyPaymentReceived } from '../services/notification.js';
import db from '../config/db.js';
import { saveBase64Image } from '../services/imageService.js';

// Record payment collection (Agent or Borrower)
export async function collectPayment(req, res) {
  try {
    const { loan_id, amount, notes, proof_image_url, payment_method, idempotency_key } = req.body;

    if (!loan_id || !amount || !idempotency_key) {
      return res.status(400).json({ message: 'Loan ID, payment amount, and idempotency key are required.' });
    }

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number.' });
    }

    // Check if idempotency key has already been used
    const existingTx = await db('transactions').where({ idempotency_key }).first();
    if (existingTx) {
      return res.status(409).json({ 
        message: 'This payment has already been recorded (Duplicate transaction detected).',
        transaction: existingTx
      });
    }

    // Determine collector ID
    let agentId = req.user.id;
    if (req.user.role === 'borrower') {
      const loan = await db('loans').where({ id: loan_id }).first();
      if (!loan) {
        return res.status(404).json({ message: 'Loan not found.' });
      }
      agentId = loan.assigned_agent_id || loan.lender_id;
    }

    // Save proof image to disk if provided
    let savedProofUrl = null;
    if (proof_image_url) {
      savedProofUrl = saveBase64Image(proof_image_url, 'payment');
    }

    // Record the payment in ledger inside a database transaction
    const result = await recordPaymentCollection({
      loanId: loan_id,
      agentId,
      amount: payAmount,
      notes,
      proofImageUrl: savedProofUrl,
      paymentMethod: payment_method || 'cash',
      idempotencyKey: idempotency_key
    });

    // Send notifications in background
    notifyPaymentReceived({
      borrower: result.borrower,
      admin: result.admin,
      amount: result.amount,
      balance: result.newBalance
    }).catch(err => console.error('Notification failed:', err));

    // Fetch detailed transaction to return for immediate receipt display
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
        'loans.current_balance as loan_current_balance',
        'loans.status as loan_status'
      )
      .where('transactions.id', result.transactionId)
      .first();

    res.status(201).json({
      message: 'Payment collection recorded and posted to ledger.',
      transactionId: result.transactionId,
      newBalance: result.newBalance,
      status: result.status,
      transaction: detailedTx
    });

  } catch (error) {
    console.error('Payment collection error:', error);
    if (error.message.includes('exceeds outstanding balance') || error.message.includes('already been fully paid') || error.message.includes('defaulted')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal server error while processing payment.' });
  }
}

// Get payment history
export async function getPaymentHistory(req, res) {
  try {
    const { role, id } = req.user;
    const { borrowerId, agentId } = req.query;

    let query = db('transactions')
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
        'loans.current_balance as loan_current_balance',
        'loans.status as loan_status'
      );

    // Apply RBAC filters
    if (role === 'agent') {
      query = query.where('transactions.agent_id', id);
    } else if (role === 'borrower') {
      query = query.where('transactions.borrower_id', id);
    }

    // Apply query filters
    if (borrowerId && role === 'admin') {
      query = query.where('transactions.borrower_id', borrowerId);
    }
    if (agentId && role === 'admin') {
      query = query.where('transactions.agent_id', agentId);
    }

    const history = await query.orderBy('transactions.payment_date', 'desc');
    res.json(history);
  } catch (error) {
    console.error('Fetch payment history error:', error);
    res.status(500).json({ message: 'Failed to retrieve payment history.' });
  }
}
