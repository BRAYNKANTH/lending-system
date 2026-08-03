import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken, authorize } from '../middleware/auth.js';
import {
  registerUser, loginUser, getAgents, getBorrowers,
  changePassword, resetUserPassword, listUsers, setUserStatus
} from '../controllers/authController.js';
import { createLoan, getLoans, getLoanDetails, updateLoan, markLoanDefaulted, applyLoanPenalty } from '../controllers/loanController.js';
import { collectPayment, getPaymentHistory } from '../controllers/paymentController.js';
import { getAdminDashboard, getAgentDashboard, getBorrowerDashboard } from '../controllers/dashboardController.js';
import { submitRemittance, getRemittances, verifyRemittance, getCashReconciliation } from '../controllers/remittanceController.js';
import { getLedgerReport } from '../controllers/reportController.js';
import { runInterestAccruals } from '../services/interest.js';

const router = express.Router();

// Tighter limiter specifically on login to blunt credential brute-forcing
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts from this network. Please wait 15 minutes and try again.' }
});

// --- AUTHENTICATION ROUTES ---
router.post('/auth/login', loginLimiter, loginUser);
router.post('/auth/register', authenticateToken, authorize('admin'), registerUser);
router.post('/auth/change-password', authenticateToken, changePassword);
router.get('/users/agents', authenticateToken, authorize('admin'), getAgents);
router.get('/users/borrowers', authenticateToken, authorize('admin', 'agent'), getBorrowers);

// --- USER MANAGEMENT ROUTES (Admin only) ---
router.get('/users', authenticateToken, authorize('admin'), listUsers);
router.patch('/users/:id/status', authenticateToken, authorize('admin'), setUserStatus);
router.post('/users/:id/reset-password', authenticateToken, authorize('admin'), resetUserPassword);

// --- LOAN MANAGEMENT ROUTES ---
router.post('/loans', authenticateToken, authorize('admin'), createLoan);
router.get('/loans', authenticateToken, getLoans);
router.get('/loans/:id', authenticateToken, getLoanDetails);
router.patch('/loans/:id', authenticateToken, authorize('admin'), updateLoan);
router.post('/loans/:id/default', authenticateToken, authorize('admin'), markLoanDefaulted);
router.post('/loans/:id/apply-penalty', authenticateToken, authorize('admin'), applyLoanPenalty);

// Admin-only manual route to force-accrue interest for testing/demonstration
router.post('/loans/accrue-interest', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const results = await runInterestAccruals();
    res.json({
      message: 'Manual interest accrual process completed.',
      results
    });
  } catch (error) {
    console.error('Manual interest accrual error:', error);
    res.status(500).json({ message: 'Interest accrual engine execution failed.' });
  }
});

// --- PAYMENT COLLECTION ROUTES ---
router.post('/payments', authenticateToken, authorize('agent', 'borrower'), collectPayment);
router.get('/payments/history', authenticateToken, getPaymentHistory);

// --- CASH REMITTANCE / RECONCILIATION ROUTES ---
router.post('/remittances', authenticateToken, authorize('agent'), submitRemittance);
router.get('/remittances', authenticateToken, authorize('admin', 'agent'), getRemittances);
router.patch('/remittances/:id/verify', authenticateToken, authorize('admin'), verifyRemittance);
router.get('/cash-reconciliation', authenticateToken, authorize('admin', 'agent'), getCashReconciliation);

// --- REPORTS ---
router.get('/reports/ledger', authenticateToken, authorize('admin'), getLedgerReport);

// --- DASHBOARD ROUTE S ---
router.get('/dashboard/admin', authenticateToken, authorize('admin'), getAdminDashboard);
router.get('/dashboard/agent', authenticateToken, authorize('agent'), getAgentDashboard);
router.get('/dashboard/borrower', authenticateToken, authorize('borrower'), getBorrowerDashboard);

export default router;
