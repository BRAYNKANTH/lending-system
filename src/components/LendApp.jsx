'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/apiClient.js';

export default function LendApp() {
  const [token, setToken] = useState(localStorage.getItem('lend_token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('lend_user')));
  const [view, setView] = useState('dashboard'); // 'dashboard', 'loans', 'ledger'
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'loans', 'agents'
  const [agentSubView, setAgentSubView] = useState('collect'); // 'collect', 'history'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Real-time toast notifications list
  const [toastAlerts, setToastAlerts] = useState([]);

  // Data storage
  const [adminData, setAdminData] = useState(null);
  const [agentData, setAgentData] = useState(null);
  const [borrowerData, setBorrowerData] = useState(null);
  const [borrowersList, setBorrowersList] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [selectedLoanId, setSelectedLoanId] = useState(null);
  const [loanStatement, setLoanStatement] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Admin: Cash & Tools view data (users, remittances, ledger report)
  const [adminUsers, setAdminUsers] = useState([]);
  const [remittances, setRemittances] = useState([]);
  const [ledgerReport, setLedgerReport] = useState(null);
  const [cashReconciliation, setCashReconciliation] = useState(null);

  // Agent: cash remittance submission form
  const [remittanceForm, setRemittanceForm] = useState({ amount: '', notes: '' });

  // Change password modal (all roles)
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });

  // Admin: loan edit/default/penalty controls on the statement view
  const [loanEditForm, setLoanEditForm] = useState({ interest_rate: '', assigned_agent_id: '' });
  const [defaultReason, setDefaultReason] = useState('');
  const [penaltyForm, setPenaltyForm] = useState({ amount: '', reason: '' });

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [newLoan, setNewLoan] = useState({
    borrower_name: '',
    borrower_phone: '',
    principal_amount: '',
    interest_rate: '2.00',
    interest_type: 'daily',
    assigned_agent_id: '',
    nic_number: '',
    nic_photo: ''
  });
  const [includeGuarantor, setIncludeGuarantor] = useState(false);
  const emptyGuarantor = {
    full_name: '', nic_number: '', gender: '', ethnicity: '', date_of_birth: '',
    address: '', phone: '', email: '',
    protected_under_debt_act: false, has_pending_court_cases: false,
    monthly_income_business: '', monthly_income_agriculture: '', monthly_income_other: '',
    monthly_expense_food: '', monthly_expense_rent: '', monthly_expense_other: ''
  };
  const [guarantorForm, setGuarantorForm] = useState(emptyGuarantor);

  // Collection payment form
  const [paymentForm, setPaymentForm] = useState({
    loan_id: '',
    payment_type: 'interest',
    amount: '',
    notes: '',
    proof_image: '',
    payment_method: 'cash',
    idempotency_key: ''
  });

  // Borrower self-payment form state
  const [borrowerPayment, setBorrowerPayment] = useState({
    loan_id: '',
    payment_type: 'interest',
    amount: '',
    payment_method: 'bank_transfer',
    notes: '',
    proof_image: '',
    idempotency_key: ''
  });

  // Listen to expired tokens
  useEffect(() => {
    const handleAuthExpired = () => {
      setToken(null);
      setUser(null);
      setError('Session expired. Please log in again.');
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  // Fetch dashboards based on user role
  useEffect(() => {
    if (!token || !user) return;
    fetchDashboardData();
  }, [token, user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      if (user.role === 'admin') {
        const data = await api.get('/dashboard/admin');
        setAdminData(data);
        const bList = await api.get('/users/borrowers');
        setBorrowersList(bList);
        const aList = await api.get('/users/agents');
        setAgentsList(aList);
      } else if (user.role === 'agent') {
        const data = await api.get('/dashboard/agent');
        setAgentData(data);
        const remits = await api.get('/remittances');
        setRemittances(remits);
        // Pre-fill idempotency key
        resetPaymentForm(data.assignedLoans?.[0]?.id || '');
      } else if (user.role === 'borrower') {
        const data = await api.get('/dashboard/borrower');
        setBorrowerData(data);
        setBorrowerPayment(prev => ({
          ...prev,
          loan_id: data.loans?.find(l => l.status === 'active')?.id || data.loans?.[0]?.id || '',
          idempotency_key: 'idemp_b_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now()
        }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Admin: load Users / Remittances / Ledger report for the Cash & Tools view
  const openAdminTools = async () => {
    setView('admin-tools');
    setSelectedLoanId(null);
    setLoanStatement(null);
    setLoading(true);
    setError('');
    try {
      const [users, remits, ledger, recon] = await Promise.all([
        api.get('/users'),
        api.get('/remittances'),
        api.get('/reports/ledger'),
        api.get('/cash-reconciliation')
      ]);
      setAdminUsers(users);
      setRemittances(remits);
      setLedgerReport(ledger);
      setCashReconciliation(recon);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshAdminTools = async () => {
    try {
      const [users, remits, ledger, recon] = await Promise.all([
        api.get('/users'),
        api.get('/remittances'),
        api.get('/reports/ledger'),
        api.get('/cash-reconciliation')
      ]);
      setAdminUsers(users);
      setRemittances(remits);
      setLedgerReport(ledger);
      setCashReconciliation(recon);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleVerifyRemittance = async (id) => {
    setLoading(true);
    setError('');
    try {
      await api.patch(`/remittances/${id}/verify`, {});
      showToast('Remittance verified.');
      refreshAdminTools();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (targetUser) => {
    setLoading(true);
    setError('');
    try {
      await api.patch(`/users/${targetUser.id}/status`, { is_active: !targetUser.is_active });
      showToast(`${targetUser.name} ${targetUser.is_active ? 'deactivated' : 'activated'}.`);
      refreshAdminTools();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetUserPassword = async (targetUser) => {
    setLoading(true);
    setError('');
    try {
      const result = await api.post(`/users/${targetUser.id}/reset-password`, {});
      showToast(`Password reset for ${targetUser.name}. Temporary password: ${result.temporaryPassword}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadLedgerCsv = () => {
    if (!ledgerReport) return;
    const header = 'Account,Debit,Credit,Net\n';
    const rows = ledgerReport.accounts.map(a => `${a.label},${a.debit.toFixed(2)},${a.credit.toFixed(2)},${a.net.toFixed(2)}`).join('\n');
    const footer = `\nTotals,${ledgerReport.totals.debit.toFixed(2)},${ledgerReport.totals.credit.toFixed(2)},`;
    const blob = new Blob([header + rows + footer], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledger-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Agent: submit a cash remittance to the office
  const handleSubmitRemittance = async (e) => {
    e.preventDefault();
    if (!remittanceForm.amount || parseFloat(remittanceForm.amount) <= 0) {
      setError('Please enter a valid remittance amount.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/remittances', { amount: parseFloat(remittanceForm.amount), notes: remittanceForm.notes });
      showToast(`LKR ${parseFloat(remittanceForm.amount).toLocaleString()} remittance submitted to the office.`);
      setRemittanceForm({ amount: '', notes: '' });
      fetchDashboardData();
      const remits = await api.get('/remittances');
      setRemittances(remits);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Any role: change own password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('New password and confirmation do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      showToast('Password changed successfully.');
      setShowChangePassword(false);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      if (user?.mustChangePassword) {
        const updatedUser = { ...user, mustChangePassword: false };
        localStorage.setItem('lend_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Admin: edit mutable loan terms from the statement view
  const handleUpdateLoan = async (e) => {
    e.preventDefault();
    if (!selectedLoanId) return;
    setLoading(true);
    setError('');
    try {
      const payload = {};
      if (loanEditForm.interest_rate !== '') payload.interest_rate = parseFloat(loanEditForm.interest_rate);
      if (loanEditForm.assigned_agent_id !== '') payload.assigned_agent_id = loanEditForm.assigned_agent_id;
      await api.patch(`/loans/${selectedLoanId}`, payload);
      showToast('Loan updated successfully.');
      setLoanEditForm({ interest_rate: '', assigned_agent_id: '' });
      viewStatement(selectedLoanId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Admin: mark a loan defaulted
  const handleMarkDefaulted = async () => {
    if (!selectedLoanId) return;
    if (!defaultReason.trim()) {
      setError('Please provide a reason before marking this loan as defaulted.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post(`/loans/${selectedLoanId}/default`, { reason: defaultReason });
      showToast('Loan marked as defaulted.');
      setDefaultReason('');
      viewStatement(selectedLoanId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Admin: apply a manual penalty / late fee
  const handleApplyPenalty = async (e) => {
    e.preventDefault();
    if (!selectedLoanId) return;
    if (!penaltyForm.amount || parseFloat(penaltyForm.amount) <= 0) {
      setError('Please enter a valid penalty amount.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post(`/loans/${selectedLoanId}/apply-penalty`, {
        amount: parseFloat(penaltyForm.amount),
        reason: penaltyForm.reason
      });
      showToast('Penalty applied and posted to the ledger.');
      setPenaltyForm({ amount: '', reason: '' });
      viewStatement(selectedLoanId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetPaymentForm = (loanId) => {
    setPaymentForm({
      loan_id: loanId || '',
      payment_type: 'interest',
      amount: '',
      notes: '',
      proof_image: '',
      payment_method: 'cash',
      idempotency_key: 'idemp_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now()
    });
  };

  const resetBorrowerPayment = (loanId) => {
    setBorrowerPayment({
      loan_id: loanId || '',
      payment_type: 'interest',
      amount: '',
      payment_method: 'bank_transfer',
      notes: '',
      proof_image: '',
      idempotency_key: 'idemp_b_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now()
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/auth/login', { email: loginEmail, password: loginPassword });
      localStorage.setItem('lend_token', data.token);
      localStorage.setItem('lend_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setView('dashboard');
      showToast(`Welcome back, ${data.user.name}!`);
      if (data.user.mustChangePassword) {
        setShowChangePassword(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('lend_token');
    localStorage.removeItem('lend_user');
    setToken(null);
    setUser(null);
    setAdminData(null);
    setAgentData(null);
    setBorrowerData(null);
    showToast('Logged out successfully.');
  };

  // Admin: Create new loan
  const handleCreateLoan = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = { ...newLoan, guarantor: includeGuarantor ? guarantorForm : null };
      const response = await api.post('/loans', payload);
      showToast(`Loan disbursed to ${newLoan.borrower_name} successfully! Notification sent.`);
      if (response.borrowerTemporaryPassword) {
        showToast(`New borrower account created. Temporary login password: ${response.borrowerTemporaryPassword} (also sent via SMS notification).`);
      }
      setNewLoan({
        borrower_name: '',
        borrower_phone: '',
        principal_amount: '',
        interest_rate: '2.00',
        interest_type: 'daily',
        assigned_agent_id: '',
        nic_number: '',
        nic_photo: ''
      });
      setIncludeGuarantor(false);
      setGuarantorForm(emptyGuarantor);
      fetchDashboardData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Admin: Force accrue interest for testing
  const handleForceAccrue = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.post('/loans/accrue-interest');
      const accruedCount = result.results?.filter(r => r.status === 'accrued').length || 0;
      showToast(`Accrual check completed. Accrued interest on ${accruedCount} active loans.`);
      fetchDashboardData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Agent: Submit cash collection
  const handleCollectPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.loan_id) {
      setError('Please select a borrower/loan.');
      return;
    }
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post('/payments', {
        loan_id: paymentForm.loan_id,
        payment_type: paymentForm.payment_type,
        amount: parseFloat(paymentForm.amount),
        notes: paymentForm.notes,
        proof_image_url: paymentForm.proof_image || null,
        payment_method: paymentForm.payment_method,
        idempotency_key: paymentForm.idempotency_key
      });

      // Find which loan was updated
      const loan = agentData.assignedLoans.find(l => l.id === paymentForm.loan_id);
      const kind = paymentForm.payment_type === 'interest' ? 'Interest' : 'Principal';

      showToast(`${kind} collection recorded successfully! LKR ${parseFloat(paymentForm.amount).toLocaleString()} collected from ${loan?.borrower_name || 'Borrower'}.`);

      // Update data
      fetchDashboardData();

      // Open the detailed receipt automatically
      if (response.transaction) {
        handleOpenReceipt(response.transaction);
      } else {
        // Fallback local assembly if response.transaction is missing
        handleOpenReceipt({
          id: response.transactionId || 'N/A',
          payment_date: new Date().toISOString(),
          payment_type: paymentForm.payment_type,
          borrower_name: loan?.borrower_name,
          borrower_phone: loan?.borrower_phone,
          agent_name: user.name,
          amount: parseFloat(paymentForm.amount),
          notes: paymentForm.notes,
          idempotency_key: paymentForm.idempotency_key,
          loan_principal: loan?.principal_amount,
          loan_interest_rate: loan?.interest_rate,
          loan_interest_type: loan?.interest_type,
          loan_principal_outstanding: response.newPrincipalOutstanding !== undefined ? response.newPrincipalOutstanding : loan?.principal_outstanding,
          loan_interest_balance: response.newInterestBalance !== undefined ? response.newInterestBalance : loan?.interest_balance
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // View loan statement
  const viewStatement = async (loanId) => {
    setSelectedLoanId(loanId);
    setView('ledger');
    setLoading(true);
    try {
      const details = await api.get(`/loans/${loanId}`);
      setLoanStatement(details);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // File to base64 converter for proof of payment
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentForm(prev => ({ ...prev, proof_image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // File to base64 converter for borrower NIC photo
  const handleNICPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewLoan(prev => ({ ...prev, nic_photo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // File to base64 converter for borrower proof of payment
  const handleBorrowerFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBorrowerPayment(prev => ({ ...prev, proof_image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBorrowerPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!borrowerPayment.loan_id) {
      setError('Please select a loan account to repay.');
      return;
    }
    if (!borrowerPayment.amount || parseFloat(borrowerPayment.amount) <= 0) {
      setError('Please enter a valid repayment amount.');
      return;
    }
    if (!borrowerPayment.proof_image) {
      setError('Please upload an image/screenshot of your payment receipt.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/payments', {
        loan_id: borrowerPayment.loan_id,
        payment_type: borrowerPayment.payment_type,
        amount: parseFloat(borrowerPayment.amount),
        notes: borrowerPayment.notes,
        proof_image_url: borrowerPayment.proof_image,
        payment_method: borrowerPayment.payment_method,
        idempotency_key: borrowerPayment.idempotency_key
      });

      const loan = borrowerData.loans.find(l => l.id === borrowerPayment.loan_id);
      const kind = borrowerPayment.payment_type === 'interest' ? 'Interest' : 'Principal';
      showToast(`${kind} payment of LKR ${parseFloat(borrowerPayment.amount).toLocaleString()} submitted successfully!`);

      // Update dashboard data
      const data = await api.get('/dashboard/borrower');
      setBorrowerData(data);

      // Open receipt
      if (response.transaction) {
        handleOpenReceipt(response.transaction);
      } else {
        handleOpenReceipt({
          id: response.transactionId || 'N/A',
          payment_date: new Date().toISOString(),
          payment_type: borrowerPayment.payment_type,
          borrower_name: user.name,
          borrower_phone: user.phone,
          agent_name: 'Lender Vault',
          amount: parseFloat(borrowerPayment.amount),
          notes: borrowerPayment.notes,
          payment_method: borrowerPayment.payment_method,
          idempotency_key: borrowerPayment.idempotency_key,
          loan_principal: loan?.principal_amount,
          loan_interest_rate: loan?.interest_rate,
          loan_interest_type: loan?.interest_type,
          loan_principal_outstanding: response.newPrincipalOutstanding !== undefined ? response.newPrincipalOutstanding : loan?.principal_outstanding,
          loan_interest_balance: response.newInterestBalance !== undefined ? response.newInterestBalance : loan?.interest_balance
        });
      }
      
      resetBorrowerPayment(data.loans?.find(l => l.status === 'active')?.id || data.loans?.[0]?.id || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Quick fill credential helper
  const fillCredentials = (email, password) => {
    setLoginEmail(email);
    setLoginPassword(password);
  };

  // Dynamic Toast popup simulator (represents SMS alerts sent to mobile phones)
  const showToast = (message) => {
    const id = Date.now() + '_' + Math.random().toString(36).slice(2);
    setToastAlerts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToastAlerts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  // Construct and show transaction receipt
  const handleOpenReceipt = (tx, context = {}) => {
    setSelectedReceipt({
      id: tx.id || tx.idempotency_key || 'N/A',
      payment_date: tx.payment_date || tx.created_at || new Date().toISOString(),
      payment_type: tx.payment_type || context.paymentType || 'interest',
      borrower_name: tx.borrower_name || context.borrowerName || user?.name || 'Customer',
      borrower_phone: tx.borrower_phone || context.borrowerPhone || user?.phone || 'N/A',
      agent_name: tx.agent_name || context.agentName || user?.name || 'Lender Staff',
      amount: parseFloat(tx.amount),
      notes: tx.notes || '',
      payment_method: tx.payment_method || context.paymentMethod || 'cash',
      idempotency_key: tx.idempotency_key || tx.id || '',
      loan_principal: tx.loan_principal !== undefined ? tx.loan_principal : (context.loanPrincipal || null),
      loan_interest_rate: tx.loan_interest_rate !== undefined ? tx.loan_interest_rate : (context.loanInterestRate || null),
      loan_interest_type: tx.loan_interest_type || context.loanInterestType || null,
      loan_principal_outstanding: tx.loan_principal_outstanding !== undefined ? tx.loan_principal_outstanding : (context.loanPrincipalOutstanding !== undefined ? context.loanPrincipalOutstanding : null),
      loan_interest_balance: tx.loan_interest_balance !== undefined ? tx.loan_interest_balance : (context.loanInterestBalance !== undefined ? context.loanInterestBalance : null)
    });
  };

  return (
    <div>
      {/* Digital Receipt Modal (Screen View) */}
      {selectedReceipt && (
        <div className="receipt-modal-overlay" onClick={() => setSelectedReceipt(null)}>
          <div className="receipt-modal-card" onClick={e => e.stopPropagation()}>
            <div className="receipt-header">
              <div className="receipt-header-icon">💵</div>
              <div className="receipt-title">LendBuddy Ledger</div>
              <div className="receipt-subtitle">Official Payment Receipt</div>
            </div>

            <div className="receipt-row">
              <span className="receipt-row-label">Receipt ID</span>
              <span className="receipt-row-value receipt-row-value-code">{selectedReceipt.id}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-row-label">Date & Time</span>
              <span className="receipt-row-value">{new Date(selectedReceipt.payment_date).toLocaleString()}</span>
            </div>
            
            <div style={{ borderTop: '1px dashed #cbd5e1', margin: '16px 0' }} />

            <div className="receipt-row">
              <span className="receipt-row-label">Customer</span>
              <span className="receipt-row-value">{selectedReceipt.borrower_name}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-row-label">Mobile</span>
              <span className="receipt-row-value">{selectedReceipt.borrower_phone}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-row-label">Collected By</span>
              <span className="receipt-row-value">{selectedReceipt.agent_name}</span>
            </div>

            <div className="receipt-amount-box">
              <div className="receipt-amount-label">{selectedReceipt.payment_type === 'principal' ? 'Principal Payment' : 'Interest Payment'} Collected</div>
              <div className="receipt-amount-val">LKR {selectedReceipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>

            {selectedReceipt.loan_principal && (
              <>
                <div style={{ borderTop: '1px dashed #cbd5e1', margin: '16px 0' }} />
                <div className="receipt-row">
                  <span className="receipt-row-label">Original Loan Principal</span>
                  <span className="receipt-row-value">LKR {parseFloat(selectedReceipt.loan_principal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-row-label">Interest Rate</span>
                  <span className="receipt-row-value" style={{ textTransform: 'capitalize' }}>{selectedReceipt.loan_interest_rate}% ({selectedReceipt.loan_interest_type})</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-row-label">Principal Outstanding</span>
                  <span className="receipt-row-value" style={{ color: 'var(--accent-rose)', fontWeight: 'bold' }}>
                    LKR {parseFloat(selectedReceipt.loan_principal_outstanding).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-row-label">Interest Due</span>
                  <span className="receipt-row-value" style={{ color: 'var(--accent-rose)', fontWeight: 'bold' }}>
                    LKR {parseFloat(selectedReceipt.loan_interest_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ borderTop: '1px dashed #cbd5e1', margin: '16px 0' }} />
              </>
            )}

            <div className="receipt-row">
              <span className="receipt-row-label">Payment Method</span>
              <span className="receipt-row-value" style={{ textTransform: 'capitalize' }}>
                {selectedReceipt.payment_method ? selectedReceipt.payment_method.replace('_', ' ') : 'Cash'}
              </span>
            </div>

            {selectedReceipt.idempotency_key && (
              <div className="receipt-row" style={{ marginTop: '6px' }}>
                <span className="receipt-row-label">Security Code</span>
                <span className="receipt-row-value receipt-row-value-code" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {selectedReceipt.idempotency_key}
                </span>
              </div>
            )}

            {selectedReceipt.notes && (
              <div className="receipt-notes-section">
                <strong>Notes:</strong> "{selectedReceipt.notes}"
              </div>
            )}

            <div className="receipt-footer">
              <p>Thank you for your payment!</p>
              <p style={{ fontSize: '11px', marginTop: '4px', color: 'var(--text-muted)' }}>This is a system generated digital receipt.</p>
            </div>

            <div className="receipt-actions">
              <button type="button" className="glass-btn glass-btn-secondary" onClick={() => setSelectedReceipt(null)}>
                Close
              </button>
              <button type="button" className="glass-btn glass-btn-emerald" onClick={() => window.print()}>
                🖨️ Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Container (Print View) */}
      {selectedReceipt && (
        <div className="receipt-print-only">
          <div className="print-header">
            <div className="print-title">LendBuddy Ledger</div>
            <div style={{ fontSize: '9pt', color: '#555555' }}>Official Payment Receipt</div>
          </div>

          <div className="print-row">
            <span>Receipt ID:</span>
            <span style={{ fontFamily: 'monospace' }}>{selectedReceipt.id}</span>
          </div>
          <div className="print-row">
            <span>Date/Time:</span>
            <span>{new Date(selectedReceipt.payment_date).toLocaleString()}</span>
          </div>

          <div className="print-divider"></div>

          <div className="print-row">
            <span>Customer:</span>
            <span>{selectedReceipt.borrower_name}</span>
          </div>
          <div className="print-row">
            <span>Mobile:</span>
            <span>{selectedReceipt.borrower_phone}</span>
          </div>
          <div className="print-row">
            <span>Agent:</span>
            <span>{selectedReceipt.agent_name}</span>
          </div>

          <div className="print-amount-box">
            <div style={{ fontSize: '8pt', textTransform: 'uppercase', marginBottom: '2px' }}>Amount Collected</div>
            <div className="print-amount-val">LKR {selectedReceipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>

          {selectedReceipt.loan_principal && (
            <>
              <div className="print-divider"></div>
              <div className="print-row">
                <span>Orig. Principal:</span>
                <span>LKR {parseFloat(selectedReceipt.loan_principal).toLocaleString()}</span>
              </div>
              <div className="print-row">
                <span>Interest Accrual:</span>
                <span style={{ textTransform: 'capitalize' }}>{selectedReceipt.loan_interest_rate}% ({selectedReceipt.loan_interest_type})</span>
              </div>
              <div className="print-row" style={{ fontWeight: 'bold' }}>
                <span>Principal Outstanding:</span>
                <span>LKR {parseFloat(selectedReceipt.loan_principal_outstanding).toLocaleString()}</span>
              </div>
              <div className="print-row" style={{ fontWeight: 'bold' }}>
                <span>Interest Due:</span>
                <span>LKR {parseFloat(selectedReceipt.loan_interest_balance).toLocaleString()}</span>
              </div>
              <div className="print-divider"></div>
            </>
          )}

          <div className="print-row">
            <span>Method:</span>
            <span style={{ textTransform: 'capitalize' }}>
              {selectedReceipt.payment_method ? selectedReceipt.payment_method.replace('_', ' ') : 'Cash'}
            </span>
          </div>

          {selectedReceipt.idempotency_key && (
            <div className="print-row" style={{ marginTop: '5px' }}>
              <span>Security Code:</span>
              <span style={{ fontFamily: 'monospace', fontSize: '8pt' }}>{selectedReceipt.idempotency_key}</span>
            </div>
          )}

          {selectedReceipt.notes && (
            <div style={{ marginTop: '8px', border: '1px dashed #000000', padding: '6px', fontSize: '8pt', fontStyle: 'italic' }}>
              <strong>Notes:</strong> "{selectedReceipt.notes}"
            </div>
          )}

          <div className="print-footer">
            <p>Thank you for your payment!</p>
            <p>This is a system generated digital receipt.</p>
          </div>
        </div>
      )}

      {/* Toast Alert overlay */}
      <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '380px' }}>
        {toastAlerts.map(toast => (
          <div key={toast.id} className="animate-fade-in" style={{ padding: '16px', background: 'var(--accent-emerald)', border: 'none', color: '#ffffff', borderRadius: '8px', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span>🔔 SMS Notification sent</span>
            </div>
            <p style={{ fontSize: '13px', lineHeight: '1.4' }}>{toast.message}</p>
          </div>
        ))}
      </div>

      {/* Header bar - Simple Solid White Bar */}
      {token && user && (
        <header className="app-header animate-fade-in">
          <div className="app-header-info">
            <h1 style={{ fontSize: '26px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>💵</span> Cash Lending Manager
            </h1>
            <span className="badge badge-active">{user.role}</span>
          </div>

          {/* Desktop Navigation Links */}
          {user.role === 'admin' && (
            <div className="desktop-header-nav">
              <button className={`nav-link-btn ${view === 'dashboard' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setSelectedLoanId(null); setLoanStatement(null); }}>🏠 Home</button>
              <button className={`nav-link-btn ${view === 'create-loan' ? 'active' : ''}`} onClick={() => { setView('create-loan'); setSelectedLoanId(null); setLoanStatement(null); }}>💵 Give Loan</button>
              <button className={`nav-link-btn ${view === 'loans' ? 'active' : ''}`} onClick={() => { setView('loans'); setSelectedLoanId(null); setLoanStatement(null); }}>📋 Check Loans</button>
              <button className={`nav-link-btn ${view === 'agents' ? 'active' : ''}`} onClick={() => { setView('agents'); setSelectedLoanId(null); setLoanStatement(null); }}>👥 Agent Route</button>
              <button className={`nav-link-btn ${view === 'admin-tools' ? 'active' : ''}`} onClick={openAdminTools}>🏦 Cash & Tools</button>
            </div>
          )}
          {user.role === 'agent' && (
            <div className="desktop-header-nav">
              <button className={`nav-link-btn ${agentSubView === 'collect' ? 'active' : ''}`} onClick={() => setAgentSubView('collect')}>💵 Collect Payments</button>
              <button className={`nav-link-btn ${agentSubView === 'history' ? 'active' : ''}`} onClick={() => setAgentSubView('history')}>📜 Collection History</button>
              <button className={`nav-link-btn ${agentSubView === 'remit' ? 'active' : ''}`} onClick={() => setAgentSubView('remit')}>🏦 Remit Cash</button>
            </div>
          )}

          <div className="app-header-nav">
            <span style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
              User: <strong style={{ color: 'var(--text-primary)' }}>{user.name}</strong>
            </span>
            <button className="glass-btn glass-btn-secondary" style={{ padding: '10px 16px', fontSize: '14px' }} onClick={() => setShowChangePassword(true)}>
              🔑 Password
            </button>
            <button className="glass-btn glass-btn-rose" style={{ padding: '10px 20px', fontSize: '15px' }} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>
      )}

      {/* Change Password Modal (all roles) */}
      {showChangePassword && (
        <div className="receipt-modal-overlay" onClick={() => setShowChangePassword(false)}>
          <div className="glass-card" style={{ maxWidth: '420px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '20px', marginBottom: '16px' }}>🔑 Change Password</h3>
            {user?.mustChangePassword && (
              <p style={{ fontSize: '13px', color: 'var(--accent-rose)', marginBottom: '12px' }}>
                You're using a temporary password. Please set a new one to continue.
              </p>
            )}
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Current Password</label>
                <input type="password" required className="glass-input" style={{ width: '100%' }}
                  value={passwordForm.current_password}
                  onChange={e => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold' }}>New Password</label>
                <input type="password" required minLength={6} className="glass-input" style={{ width: '100%' }}
                  value={passwordForm.new_password}
                  onChange={e => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Confirm New Password</label>
                <input type="password" required minLength={6} className="glass-input" style={{ width: '100%' }}
                  value={passwordForm.confirm_password}
                  onChange={e => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                {!user?.mustChangePassword && (
                  <button type="button" className="glass-btn glass-btn-secondary" style={{ flex: 1 }} onClick={() => setShowChangePassword(false)}>Cancel</button>
                )}
                <button type="submit" className="glass-btn glass-btn-emerald" style={{ flex: 1 }} disabled={loading}>Update Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main container */}
      <main className="dashboard-container">
        
        {/* Error panel */}
        {error && (
          <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-rose)', margin: '0 0 24px 0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ color: 'var(--accent-rose)', fontWeight: 'bold' }}>Error</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>{error}</p>
            </div>
            <button className="glass-btn glass-btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => setError('')}>Dismiss</button>
          </div>
        )}

        {/* ----------------- LOGIN PAGE ----------------- */}
        {!token && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '400px' }}>
              <h2 style={{ fontSize: '28px', textAlign: 'center', marginBottom: '8px' }}>Cash Lending Manager</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', marginBottom: '24px' }}>Easy loan tracking and collections</p>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>EMAIL ADDRESS</label>
                  <input type="email" required className="glass-input" placeholder="e.g. name@company.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>PASSWORD</label>
                  <input type="password" required className="glass-input" placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                </div>
                <button type="submit" className="glass-btn" disabled={loading} style={{ width: '100%', marginTop: '8px' }}>
                  {loading ? 'Loading...' : 'Login'}
                </button>
              </form>

              <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '12px', fontWeight: 'bold' }}>DEMO QUICK-FILL CREDENTIALS</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 4px', fontSize: '11px' }} onClick={() => fillCredentials('admin@lend.com', 'password123')}>Admin</button>
                  <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 4px', fontSize: '11px' }} onClick={() => fillCredentials('agent@lend.com', 'password123')}>Agent</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- ADMIN PORTAL VIEWS ----------------- */}
        {token && user && user.role === 'admin' && adminData && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* View 1: Main Grid Action Menu */}
            {view === 'dashboard' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {/* KPI Metrics row */}
                <div className="grid-cols-analytics">
                  <div className="kpi-card kpi-card-blue">
                    <span className="kpi-lbl">Active Loans</span>
                    <h3 className="kpi-val">{adminData.summary.totalActiveLoans}</h3>
                  </div>
                  <div className="kpi-card kpi-card-blue">
                    <span className="kpi-lbl">Total Lent</span>
                    <h3 className="kpi-val">LKR {adminData.summary.totalMoneyLent.toLocaleString()}</h3>
                  </div>
                  <div className="kpi-card kpi-card-emerald">
                    <span className="kpi-lbl">Total Collected</span>
                    <h3 className="kpi-val" style={{ color: 'var(--accent-emerald)' }}>LKR {adminData.summary.totalRepayments.toLocaleString()}</h3>
                  </div>
                </div>

                {/* Big Action Icon Buttons */}
                <h2 style={{ fontSize: '32px', textAlign: 'center', marginTop: '24px', marginBottom: '12px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  What do you want to do?
                </h2>
                <div className="menu-card-grid">
                  
                  <div className="menu-card menu-card-give" onClick={() => setView('create-loan')}>
                    <span className="menu-card-icon">💵</span>
                    <div>
                      <h3 style={{ fontSize: '26px', marginBottom: '10px', fontWeight: '800', color: 'var(--accent-emerald)' }}>Give New Loan</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: '1.5' }}>Type borrower name and phone number to disburse cash instantly</p>
                    </div>
                  </div>

                  <div className="menu-card menu-card-check" onClick={() => setView('loans')}>
                    <span className="menu-card-icon">📋</span>
                    <div>
                      <h3 style={{ fontSize: '26px', marginBottom: '10px', fontWeight: '800', color: 'var(--accent-blue)' }}>Check Loans & Payments</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: '1.5' }}>Search and view customer accounts, balances, and ledger sheets</p>
                    </div>
                  </div>

                  <div className="menu-card menu-card-agent" onClick={() => setView('agents')}>
                    <span className="menu-card-icon">👥</span>
                    <div>
                      <h3 style={{ fontSize: '26px', marginBottom: '10px', fontWeight: '800', color: '#7c3aed' }}>Agent Route Progress</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: '1.5' }}>Check cash collections collected by your agents today</p>
                    </div>
                  </div>

                </div>

                {/* Interest Accrual & Formula Dashboard */}
                <div className="glass-card" style={{ marginTop: '16px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📈</span> Interest Accrual & Calculations Center
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                    Tracking automated interest accrued on active loans based on compounding frequencies.
                  </p>

                  <div className="responsive-grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {/* Totals by Frequency */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Accrued Interest Revenue Breakdown</h3>
                      
                      {['daily', 'weekly', 'monthly'].map(freq => {
                        const freqTotal = adminData.interestByType?.find(i => i.interest_type === freq)?.total || 0;
                        const grandTotal = adminData.interestByType?.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0) || 1;
                        const percentage = Math.min(100, Math.round((parseFloat(freqTotal) / grandTotal) * 100)) || 0;
                        
                        return (
                          <div key={freq} style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ textTransform: 'capitalize', fontWeight: 'bold', fontSize: '14px' }}>{freq} Loans</span>
                              <strong style={{ color: 'var(--accent-gold)' }}>LKR {parseFloat(freqTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                            </div>
                            <div style={{ background: 'var(--bg-primary)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ background: 'var(--accent-gold)', height: '100%', width: `${percentage}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* How Calculations Work */}
                    <div style={{ padding: '16px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '12px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>📊 Interest Posting Formulas</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', lineHeight: '1.4' }}>
                        <div>
                          <strong style={{ color: 'var(--accent-blue)', display: 'block', marginBottom: '4px' }}>Daily Accrual Formula:</strong>
                          <span style={{ color: 'var(--text-secondary)' }}><code>Interest = Principal × (Rate / 100)</code> applied every 24 hours.</span>
                        </div>
                        <div>
                          <strong style={{ color: 'var(--accent-blue)', display: 'block', marginBottom: '4px' }}>Weekly Accrual Formula:</strong>
                          <span style={{ color: 'var(--text-secondary)' }}><code>Interest = Principal × (Rate / 100)</code> applied every 7 days.</span>
                        </div>
                        <div>
                          <strong style={{ color: 'var(--accent-blue)', display: 'block', marginBottom: '4px' }}>Monthly Accrual Formula:</strong>
                          <span style={{ color: 'var(--text-secondary)' }}><code>Interest = Principal × (Rate / 100)</code> applied every 30 days.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Accrual Logs */}
                  <div style={{ marginTop: '32px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>Recent Interest Accrual Logs</h3>
                    {!adminData.recentAccruals || adminData.recentAccruals.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No interest accrued yet.</p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="glass-table" style={{ fontSize: '14px' }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '12px 16px', fontSize: '12px' }}>Borrower</th>
                              <th style={{ padding: '12px 16px', fontSize: '12px' }}>Accrual Date</th>
                              <th style={{ padding: '12px 16px', fontSize: '12px' }}>Accrued Amount</th>
                              <th style={{ padding: '12px 16px', fontSize: '12px' }}>Calculation Log (Formula Step)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminData.recentAccruals.map((acc, idx) => (
                              <tr key={idx} style={{ fontSize: '14px' }}>
                                <td style={{ padding: '12px 16px' }}><strong>{acc.borrower_name}</strong></td>
                                <td style={{ padding: '12px 16px' }}>{new Date(acc.created_at).toLocaleString()}</td>
                                <td style={{ padding: '12px 16px', color: 'var(--accent-rose)', fontWeight: 'bold' }}>+LKR {parseFloat(acc.amount_accrued).toLocaleString()}</td>
                                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>{acc.calculation_log}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* View 2: Give New Loan form */}
            {view === 'create-loan' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button className="glass-btn glass-btn-secondary" style={{ fontSize: '15px', fontWeight: 'bold' }} onClick={() => setView('dashboard')}>
                    ⬅️ Back to Main Menu
                  </button>
                </div>

                <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                  <h3 style={{ fontSize: '28px', marginBottom: '8px' }}>💵 Give New Loan</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>Type customer details to start a loan. Borrower registration happens automatically.</p>
                  
                  <form onSubmit={handleCreateLoan} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>BORROWER NAME</label>
                      <input type="text" required className="glass-input" placeholder="e.g. Bandara Perera" value={newLoan.borrower_name} onChange={e => setNewLoan(prev => ({ ...prev, borrower_name: e.target.value }))} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>BORROWER MOBILE NUMBER (SRI LANKA)</label>
                      <input type="tel" required className="glass-input" placeholder="e.g. 0771234567 or +94771234567" value={newLoan.borrower_phone} onChange={e => setNewLoan(prev => ({ ...prev, borrower_phone: e.target.value }))} />
                    </div>

                    <div className="form-grid-2-col">
                      <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>NIC NUMBER</label>
                        <input type="text" required className="glass-input" placeholder="e.g. 199012345678 or 123456789V" value={newLoan.nic_number} onChange={e => setNewLoan(prev => ({ ...prev, nic_number: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>NIC PHOTO</label>
                        <input type="file" accept="image/*" className="glass-input" onChange={handleNICPhotoChange} />
                        {newLoan.nic_photo && (
                          <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <img src={newLoan.nic_photo} alt="NIC preview" style={{ width: '45px', height: '30px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-glass)' }} />
                            <span style={{ fontSize: '11px', color: 'var(--accent-emerald)' }}>✓ Photo Attached</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>PRINCIPAL AMOUNT (LKR)</label>
                      <input type="number" min="1" required className="glass-input" placeholder="e.g. 50000" value={newLoan.principal_amount} onChange={e => setNewLoan(prev => ({ ...prev, principal_amount: e.target.value }))} />
                    </div>

                    <div className="form-grid-2-col">
                      <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>INTEREST RATE (%)</label>
                        <input type="number" step="0.01" min="0" required className="glass-input" placeholder="2.00" value={newLoan.interest_rate} onChange={e => setNewLoan(prev => ({ ...prev, interest_rate: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>ACCRUAL FREQUENCY</label>
                        <select required className="glass-input" value={newLoan.interest_type} onChange={e => setNewLoan(prev => ({ ...prev, interest_type: e.target.value }))}>
                          <option value="daily">Daily Accumulation</option>
                          <option value="weekly">Weekly Accumulation</option>
                          <option value="monthly">Monthly Accumulation</option>
                        </select>
                      </div>
                    </div>

                    {newLoan.principal_amount > 0 && newLoan.interest_rate > 0 && (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '-8px 0 0' }}>
                        {(() => {
                          const p = parseFloat(newLoan.principal_amount) || 0;
                          const r = parseFloat(newLoan.interest_rate) || 0;
                          const perPeriod = p * (r / 100);
                          return `Interest-only loan: borrower owes LKR ${perPeriod.toLocaleString(undefined, { maximumFractionDigits: 2 })} interest every ${newLoan.interest_type === 'daily' ? 'day' : newLoan.interest_type === 'weekly' ? 'week' : 'month'} until the LKR ${p.toLocaleString()} principal is repaid in full (whenever the borrower is ready).`;
                        })()}
                      </p>
                    )}

                    <div style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '14px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                        <input type="checkbox" checked={includeGuarantor} onChange={e => setIncludeGuarantor(e.target.checked)} />
                        🛡️ ADD GUARANTOR DETAILS (optional)
                      </label>

                      {includeGuarantor && (
                        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div className="form-grid-2-col">
                            <div>
                              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Full Name *</label>
                              <input required={includeGuarantor} type="text" className="glass-input" value={guarantorForm.full_name} onChange={e => setGuarantorForm(prev => ({ ...prev, full_name: e.target.value }))} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>NIC Number *</label>
                              <input required={includeGuarantor} type="text" className="glass-input" placeholder="e.g. 199012345678 or 123456789V" value={guarantorForm.nic_number} onChange={e => setGuarantorForm(prev => ({ ...prev, nic_number: e.target.value }))} />
                            </div>
                          </div>

                          <div className="form-grid-2-col">
                            <div>
                              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Gender</label>
                              <select className="glass-input" value={guarantorForm.gender} onChange={e => setGuarantorForm(prev => ({ ...prev, gender: e.target.value }))}>
                                <option value="">-- Select --</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Ethnicity / Citizenship</label>
                              <input type="text" className="glass-input" value={guarantorForm.ethnicity} onChange={e => setGuarantorForm(prev => ({ ...prev, ethnicity: e.target.value }))} />
                            </div>
                          </div>

                          <div className="form-grid-2-col">
                            <div>
                              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Date of Birth</label>
                              <input type="date" className="glass-input" value={guarantorForm.date_of_birth} onChange={e => setGuarantorForm(prev => ({ ...prev, date_of_birth: e.target.value }))} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Phone Number *</label>
                              <input required={includeGuarantor} type="tel" className="glass-input" value={guarantorForm.phone} onChange={e => setGuarantorForm(prev => ({ ...prev, phone: e.target.value }))} />
                            </div>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Address *</label>
                            <input required={includeGuarantor} type="text" className="glass-input" value={guarantorForm.address} onChange={e => setGuarantorForm(prev => ({ ...prev, address: e.target.value }))} />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Email</label>
                            <input type="email" className="glass-input" value={guarantorForm.email} onChange={e => setGuarantorForm(prev => ({ ...prev, email: e.target.value }))} />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                              <input type="checkbox" checked={guarantorForm.protected_under_debt_act} onChange={e => setGuarantorForm(prev => ({ ...prev, protected_under_debt_act: e.target.checked }))} />
                              Protected under the state debt recovery act or any other law?
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                              <input type="checkbox" checked={guarantorForm.has_pending_court_cases} onChange={e => setGuarantorForm(prev => ({ ...prev, has_pending_court_cases: e.target.checked }))} />
                              Any court judgments/cases registered against them?
                            </label>
                          </div>

                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>Monthly Income (LKR)</p>
                            <div className="form-grid-3-col">
                              <input type="number" min="0" className="glass-input" placeholder="Business" value={guarantorForm.monthly_income_business} onChange={e => setGuarantorForm(prev => ({ ...prev, monthly_income_business: e.target.value }))} />
                              <input type="number" min="0" className="glass-input" placeholder="Agriculture" value={guarantorForm.monthly_income_agriculture} onChange={e => setGuarantorForm(prev => ({ ...prev, monthly_income_agriculture: e.target.value }))} />
                              <input type="number" min="0" className="glass-input" placeholder="Other" value={guarantorForm.monthly_income_other} onChange={e => setGuarantorForm(prev => ({ ...prev, monthly_income_other: e.target.value }))} />
                            </div>
                          </div>

                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>Monthly Expense (LKR)</p>
                            <div className="form-grid-3-col">
                              <input type="number" min="0" className="glass-input" placeholder="Food" value={guarantorForm.monthly_expense_food} onChange={e => setGuarantorForm(prev => ({ ...prev, monthly_expense_food: e.target.value }))} />
                              <input type="number" min="0" className="glass-input" placeholder="House Rent" value={guarantorForm.monthly_expense_rent} onChange={e => setGuarantorForm(prev => ({ ...prev, monthly_expense_rent: e.target.value }))} />
                              <input type="number" min="0" className="glass-input" placeholder="Other" value={guarantorForm.monthly_expense_other} onChange={e => setGuarantorForm(prev => ({ ...prev, monthly_expense_other: e.target.value }))} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>ASSIGN COLLECTION AGENT</label>
                      <select className="glass-input" value={newLoan.assigned_agent_id} onChange={e => setNewLoan(prev => ({ ...prev, assigned_agent_id: e.target.value }))}>
                        <option value="">-- No Agent (Self Collect) --</option>
                        {agentsList.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>

                    <button type="submit" className="glass-btn glass-btn-emerald" disabled={loading} style={{ width: '100%', marginTop: '10px', padding: '16px' }}>
                      Disburse Cash Loan
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* View 3: Check Loans & ledger list */}
            {view === 'loans' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button className="glass-btn glass-btn-secondary" style={{ fontSize: '15px', fontWeight: 'bold' }} onClick={() => setView('dashboard')}>
                    ⬅️ Back to Main Menu
                  </button>
                  
                  {/* Small, non-intrusive Manual Accrual button trigger */}
                  <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }} onClick={handleForceAccrue} disabled={loading}>
                    ⚡ Update Interest Now
                  </button>
                </div>

                {/* Overdue loans card */}
                {adminData.overdueLoans.length > 0 && (
                  <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-rose)' }}>
                    <h3 style={{ fontSize: '24px', marginBottom: '16px', color: 'var(--accent-rose)' }}>⚠️ Overdue Accounts</h3>
                    
                    {/* Desktop View Table */}
                    <div className="desktop-only" style={{ overflowX: 'auto' }}>
                      <table className="glass-table">
                        <thead>
                          <tr>
                            <th>Borrower</th>
                            <th>Type</th>
                            <th>Principal</th>
                            <th>Rate</th>
                            <th>Outstanding</th>
                            <th>Accrual Date</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminData.overdueLoans.map(loan => (
                            <tr key={loan.id}>
                              <td>
                                <strong>{loan.borrower_name}</strong>
                              </td>
                              <td style={{ textTransform: 'capitalize' }}>{loan.interest_type}</td>
                              <td>LKR {parseFloat(loan.principal_amount).toLocaleString()}</td>
                              <td>{loan.interest_rate}%</td>
                              <td style={{ color: 'var(--accent-rose)', fontWeight: 'bold' }}>
                                <div>Principal: LKR {parseFloat(loan.principal_outstanding).toLocaleString()}</div>
                                <div style={{ fontSize: '12px', fontWeight: 'normal' }}>Interest due: LKR {parseFloat(loan.interest_balance).toLocaleString()}</div>
                              </td>
                              <td style={{ color: 'var(--accent-rose)' }}>
                                {new Date(loan.next_accrual_date).toLocaleDateString()}
                              </td>
                              <td>
                                <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }} onClick={() => viewStatement(loan.id)}>
                                  Check Account
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile View Cards */}
                    <div className="mobile-only mobile-card-list">
                      {adminData.overdueLoans.map(loan => (
                        <div 
                          key={loan.id} 
                          className="mobile-row-card mobile-row-card-danger"
                          onClick={() => viewStatement(loan.id)}
                          style={{ cursor: 'pointer', transition: 'transform 0.1s ease, box-shadow 0.1s ease' }}
                        >
                          <div className="mobile-row-card-header">
                            <span className="mobile-row-card-title">{loan.borrower_name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="badge badge-defaulted">Overdue</span>
                              <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '16px' }}>➔</span>
                            </div>
                          </div>
                          <div className="mobile-row-card-grid-compact">
                            <div>
                              <span className="mobile-row-card-label">Principal:</span>
                              <span className="mobile-row-card-value"> LKR {parseFloat(loan.principal_amount).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="mobile-row-card-label">Rate:</span>
                              <span className="mobile-row-card-value"> {loan.interest_rate}%</span>
                            </div>
                            <div>
                              <span className="mobile-row-card-label">Type:</span>
                              <span className="mobile-row-card-value" style={{ textTransform: 'capitalize' }}> {loan.interest_type}</span>
                            </div>
                            <div>
                              <span className="mobile-row-card-label">Accrual:</span>
                              <span className="mobile-row-card-value" style={{ color: 'var(--accent-rose)' }}> {new Date(loan.next_accrual_date).toLocaleDateString()}</span>
                            </div>
                            <div>
                              <span className="mobile-row-card-label">Principal Due:</span>
                              <span className="mobile-row-card-value" style={{ color: 'var(--accent-rose)', fontWeight: 'bold' }}> LKR {parseFloat(loan.principal_outstanding).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="mobile-row-card-label">Interest Due:</span>
                              <span className="mobile-row-card-value" style={{ color: 'var(--accent-rose)', fontWeight: 'bold' }}> LKR {parseFloat(loan.interest_balance).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                )}

                {/* All Active Loans list */}
                <LoansLoader onSelect={viewStatement} fetchTrigger={adminData} />
              </div>
            )}

            {/* View 4: Agent Route Performance metrics */}
            {view === 'agents' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button className="glass-btn glass-btn-secondary" style={{ fontSize: '15px', fontWeight: 'bold' }} onClick={() => setView('dashboard')}>
                    ⬅️ Back to Main Menu
                  </button>
                </div>

                <div className="glass-card">
                  <h3 style={{ fontSize: '26px', marginBottom: '20px' }}>🏃 Agent Collections Today</h3>
                  {adminData.agentPerformance.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>No collections posted by agents today.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {adminData.agentPerformance.map((perf, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                            <span style={{ fontWeight: 'bold' }}>{perf.agent_name}</span>
                            <strong style={{ color: 'var(--accent-emerald)', fontSize: '18px' }}>LKR {parseFloat(perf.total_collected).toLocaleString()}</strong>
                          </div>
                          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', height: '14px', borderRadius: '7px', overflow: 'hidden' }}>
                            <div style={{ 
                              background: 'var(--accent-emerald)', 
                              height: '100%', 
                              width: `${Math.min(100, (parseFloat(perf.total_collected) / Math.max(...adminData.agentPerformance.map(p => parseFloat(p.total_collected) || 1))) * 100)}%` 
                            }} />
                          </div>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{perf.collections_count} cash deposits successfully processed on assigned route</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* View 5: Cash & Tools — remittance verification, cash reconciliation, ledger report, user management */}
            {view === 'admin-tools' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button className="glass-btn glass-btn-secondary" style={{ fontSize: '15px', fontWeight: 'bold' }} onClick={() => setView('dashboard')}>
                    ⬅️ Back to Main Menu
                  </button>
                </div>

                {/* Agent cash-in-hand reconciliation */}
                <div className="glass-card">
                  <h3 style={{ fontSize: '22px', marginBottom: '16px' }}>💼 Agent Cash-in-Hand Reconciliation</h3>
                  {!cashReconciliation || cashReconciliation.agents.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No agents found.</p>
                  ) : (
                    <>
                      <div className="desktop-only" style={{ overflowX: 'auto' }}>
                        <table className="glass-table">
                          <thead>
                            <tr>
                              <th>Agent</th>
                              <th>Collected</th>
                              <th>Remitted</th>
                              <th>Cash in Hand</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cashReconciliation.agents.map(a => (
                              <tr key={a.agentId}>
                                <td style={{ fontWeight: 'bold' }}>{a.agentName}</td>
                                <td>LKR {a.totalCollected.toLocaleString()}</td>
                                <td>LKR {a.totalRemitted.toLocaleString()}</td>
                                <td style={{ fontWeight: 'bold', color: a.cashInHand > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                                  LKR {a.cashInHand.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mobile-only mobile-card-list">
                        {cashReconciliation.agents.map(a => (
                          <div key={a.agentId} className={`mobile-row-card ${a.cashInHand > 0 ? 'mobile-row-card-warning' : 'mobile-row-card-success'}`}>
                            <div className="mobile-row-card-header">
                              <span className="mobile-row-card-title">{a.agentName}</span>
                              <span className="mobile-row-card-value" style={{ fontWeight: 'bold', color: a.cashInHand > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                                LKR {a.cashInHand.toLocaleString()}
                              </span>
                            </div>
                            <div className="mobile-row-card-grid">
                              <span className="mobile-row-card-label">Collected</span>
                              <span className="mobile-row-card-value">LKR {a.totalCollected.toLocaleString()}</span>

                              <span className="mobile-row-card-label">Remitted</span>
                              <span className="mobile-row-card-value">LKR {a.totalRemitted.toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Pending / recent remittances */}
                <div className="glass-card">
                  <h3 style={{ fontSize: '22px', marginBottom: '16px' }}>🚚 Cash Remittances</h3>
                  {remittances.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No remittances submitted yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {remittances.map(r => (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                          <div>
                            <div style={{ fontWeight: 'bold' }}>{r.agent_name} — LKR {parseFloat(r.amount).toLocaleString()}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleString()} {r.notes ? `• ${r.notes}` : ''}</div>
                          </div>
                          {r.status === 'verified' ? (
                            <span className="badge badge-active">Verified</span>
                          ) : (
                            <button className="glass-btn glass-btn-emerald" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => handleVerifyRemittance(r.id)} disabled={loading}>
                              Verify
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ledger / trial balance report */}
                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ fontSize: '22px' }}>📒 Ledger / Trial Balance</h3>
                    <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={downloadLedgerCsv} disabled={!ledgerReport}>
                      ⬇️ Export CSV
                    </button>
                  </div>
                  {!ledgerReport ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading ledger report...</p>
                  ) : (
                    <>
                      <div className="desktop-only" style={{ overflowX: 'auto' }}>
                        <table className="glass-table">
                          <thead>
                            <tr>
                              <th>Account</th>
                              <th>Debit</th>
                              <th>Credit</th>
                              <th>Net</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ledgerReport.accounts.map(a => (
                              <tr key={a.account}>
                                <td style={{ fontWeight: 'bold' }}>{a.label}</td>
                                <td>LKR {a.debit.toLocaleString()}</td>
                                <td>LKR {a.credit.toLocaleString()}</td>
                                <td>LKR {a.net.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: '2px solid var(--border-light)', fontWeight: 'bold' }}>
                              <td>Totals</td>
                              <td>LKR {ledgerReport.totals.debit.toLocaleString()}</td>
                              <td>LKR {ledgerReport.totals.credit.toLocaleString()}</td>
                              <td style={{ color: ledgerReport.totals.balanced ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                                {ledgerReport.totals.balanced ? '✓ Balanced' : '✗ Out of balance'}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className="mobile-only mobile-card-list">
                        {ledgerReport.accounts.map(a => (
                          <div key={a.account} className="mobile-row-card">
                            <div className="mobile-row-card-header">
                              <span className="mobile-row-card-title">{a.label}</span>
                              <span className="mobile-row-card-value" style={{ fontWeight: 'bold' }}>Net: LKR {a.net.toLocaleString()}</span>
                            </div>
                            <div className="mobile-row-card-grid">
                              <span className="mobile-row-card-label">Debit</span>
                              <span className="mobile-row-card-value">LKR {a.debit.toLocaleString()}</span>

                              <span className="mobile-row-card-label">Credit</span>
                              <span className="mobile-row-card-value">LKR {a.credit.toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                        <div className={`mobile-row-card ${ledgerReport.totals.balanced ? 'mobile-row-card-success' : 'mobile-row-card-danger'}`}>
                          <div className="mobile-row-card-header">
                            <span className="mobile-row-card-title">Totals</span>
                            <span className="mobile-row-card-value" style={{ fontWeight: 'bold', color: ledgerReport.totals.balanced ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                              {ledgerReport.totals.balanced ? '✓ Balanced' : '✗ Out of balance'}
                            </span>
                          </div>
                          <div className="mobile-row-card-grid">
                            <span className="mobile-row-card-label">Debit</span>
                            <span className="mobile-row-card-value">LKR {ledgerReport.totals.debit.toLocaleString()}</span>

                            <span className="mobile-row-card-label">Credit</span>
                            <span className="mobile-row-card-value">LKR {ledgerReport.totals.credit.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* User management */}
                <div className="glass-card">
                  <h3 style={{ fontSize: '22px', marginBottom: '16px' }}>👤 User Management</h3>

                  <div className="desktop-only" style={{ overflowX: 'auto' }}>
                    <table className="glass-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Contact</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminUsers.map(u => (
                          <tr key={u.id}>
                            <td style={{ fontWeight: 'bold' }}>{u.name}</td>
                            <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                            <td style={{ fontSize: '12px' }}>{u.email}<br />{u.phone}</td>
                            <td>
                              <span className={`badge ${u.is_active ? 'badge-active' : 'badge-defaulted'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                            </td>
                            <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button className="glass-btn glass-btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleToggleUserStatus(u)} disabled={loading || u.id === user.id}>
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button className="glass-btn glass-btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleResetUserPassword(u)} disabled={loading}>
                                Reset Password
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mobile-only mobile-card-list">
                    {adminUsers.map(u => (
                      <div key={u.id} className="mobile-row-card">
                        <div className="mobile-row-card-header">
                          <span className="mobile-row-card-title">{u.name}</span>
                          <span className={`badge ${u.is_active ? 'badge-active' : 'badge-defaulted'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                        <div className="mobile-row-card-grid">
                          <span className="mobile-row-card-label">Role</span>
                          <span className="mobile-row-card-value" style={{ textTransform: 'capitalize' }}>{u.role}</span>

                          <span className="mobile-row-card-label">Email</span>
                          <span className="mobile-row-card-value">{u.email}</span>

                          <span className="mobile-row-card-label">Phone</span>
                          <span className="mobile-row-card-value">{u.phone}</span>
                        </div>
                        <div className="mobile-row-card-actions">
                          <button className="glass-btn glass-btn-secondary" onClick={() => handleToggleUserStatus(u)} disabled={loading || u.id === user.id}>
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button className="glass-btn glass-btn-secondary" onClick={() => handleResetUserPassword(u)} disabled={loading}>
                            Reset Password
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Removed duplicate helper from here as it is integrated inside Tab 2 */}

        {/* ----------------- AGENT DASHBOARD ----------------- */}
        {token && user && user.role === 'agent' && view === 'dashboard' && agentData && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {agentSubView === 'collect' && (
              <>
                {/* KPI metrics */}
                <div className="responsive-grid-equal-2-col">
                  <div className="kpi-card kpi-card-emerald">
                    <span className="kpi-lbl">Collected Today</span>
                    <h3 className="kpi-val" style={{ color: 'var(--accent-emerald)' }}>LKR {agentData.summary.collectionsToday.toLocaleString()}</h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total cash collected today</span>
                  </div>
                  <div className="kpi-card kpi-card-blue">
                    <span className="kpi-lbl">My Customers</span>
                    <h3 className="kpi-val">{agentData.summary.assignedCount} Active</h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Customers on your route</span>
                  </div>
                </div>

                {/* Quick entry for agent collection */}
                <div className="responsive-grid-2-col">
                  
                  {/* Collection Submission Form */}
                  <div className="glass-card">
                    <h3 style={{ fontSize: '26px', marginBottom: '8px' }}>💵 Record Payment</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>Select a customer and enter the cash collected from them.</p>
                    
                    <form onSubmit={handleCollectPayment} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>CHOOSE CUSTOMER</label>
                        <select required className="glass-input" value={paymentForm.loan_id} onChange={e => resetPaymentForm(e.target.value)}>
                          <option value="">-- Select Customer --</option>
                          {agentData.assignedLoans.map(loan => (
                            <option key={loan.id} value={loan.id}>
                              {loan.borrower_name} (Principal: LKR {parseFloat(loan.principal_outstanding).toLocaleString()}, Interest Due: LKR {parseFloat(loan.interest_balance).toLocaleString()})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>PAYMENT TYPE</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button type="button"
                            className={`glass-btn ${paymentForm.payment_type === 'interest' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
                            style={{ flex: 1 }}
                            onClick={() => setPaymentForm(prev => ({ ...prev, payment_type: 'interest', amount: '' }))}>
                            Pay Interest
                          </button>
                          <button type="button"
                            className={`glass-btn ${paymentForm.payment_type === 'principal' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
                            style={{ flex: 1 }}
                            onClick={() => setPaymentForm(prev => ({ ...prev, payment_type: 'principal', amount: '' }))}>
                            Pay Principal
                          </button>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>
                          {paymentForm.payment_type === 'interest' ? 'INTEREST AMOUNT (LKR)' : 'PRINCIPAL AMOUNT (LKR)'}
                        </label>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input type="number" required min="1" className="glass-input" placeholder="Enter amount" value={paymentForm.amount} onChange={e => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))} />
                        </div>
                        {/* Quick-fill: exact amount currently due for the selected payment type */}
                        {paymentForm.loan_id && (() => {
                          const loan = agentData.assignedLoans.find(l => l.id === paymentForm.loan_id);
                          if (!loan) return null;
                          const due = paymentForm.payment_type === 'interest' ? parseFloat(loan.interest_balance) : parseFloat(loan.principal_outstanding);
                          if (!(due > 0)) return null;
                          return (
                            <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '6px', marginBottom: '8px' }} onClick={() => setPaymentForm(prev => ({ ...prev, amount: due.toString() }))}>
                              Pay full {paymentForm.payment_type === 'interest' ? 'interest' : 'principal'} due (LKR {due.toLocaleString()})
                            </button>
                          );
                        })()}
                        {/* Quick increment buttons */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {[500, 1000, 5000, 10000].map(val => (
                            <button key={val} type="button" className="glass-btn glass-btn-secondary" style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '6px' }} onClick={() => setPaymentForm(prev => ({ ...prev, amount: val.toString() }))}>
                              +LKR {val.toLocaleString()}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>PAYMENT METHOD</label>
                        <select required className="glass-input" value={paymentForm.payment_method} onChange={e => setPaymentForm(prev => ({ ...prev, payment_method: e.target.value }))}>
                          <option value="cash">💵 Cash Collection</option>
                          <option value="bank_transfer">🏦 Bank Deposit / Transfer</option>
                          <option value="mobile_wallet">📱 Mobile Wallet (eZ Cash / mCash)</option>
                          <option value="card">💳 Card Payment</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>RECEIPT PHOTO (OPTIONAL)</label>
                        <input type="file" accept="image/*" className="glass-input" onChange={handleFileChange} />
                        {paymentForm.proof_image && (
                          <div style={{ marginTop: '10px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--accent-emerald)' }}>✓ Photo attached.</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>NOTES (OPTIONAL)</label>
                        <textarea className="glass-input" rows="2" placeholder="e.g. Paid in full, promised next Friday" value={paymentForm.notes} onChange={e => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))} />
                      </div>

                      {/* Anti-double submission unique lock */}
                      <div style={{ padding: '10px', background: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Security Code: <strong>{paymentForm.idempotency_key}</strong>
                      </div>

                      <button type="submit" className="glass-btn glass-btn-emerald" disabled={loading} style={{ width: '100%' }}>
                        {loading ? 'Saving...' : 'Save Payment'}
                      </button>
                    </form>
                  </div>

                  {/* Assigned Borrowers balance list */}
                  <div className="glass-card">
                    <h3 style={{ fontSize: '24px', marginBottom: '16px' }}>👥 Customer List</h3>
                    {agentData.assignedLoans.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)' }}>No assigned customers.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {agentData.assignedLoans.map(loan => (
                          <div key={loan.id} style={{ padding: '16px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ display: 'block', fontSize: '15px' }}>{loan.borrower_name}</strong>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>📞 {loan.borrower_phone}</span>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Type: <span style={{ textTransform: 'capitalize' }}>{loan.interest_type} ({loan.interest_rate}%)</span>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-rose)' }}>
                                Principal: LKR {parseFloat(loan.principal_outstanding).toLocaleString()}
                              </span>
                              <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-rose)' }}>
                                Interest: LKR {parseFloat(loan.interest_balance).toLocaleString()}
                              </span>
                              <button className="glass-btn glass-btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', marginTop: '6px', borderRadius: '4px' }} onClick={() => resetPaymentForm(loan.id)}>
                                Collect
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </>
            )}

            {agentSubView === 'history' && (
              /* Agent Collection log */
              <div className="glass-card">
                <h3 style={{ fontSize: '24px', marginBottom: '16px' }}>📜 Saved Collections Today</h3>
                {agentData.collectionHistory.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No payments saved today.</p>
                ) : (
                  <>
                    {/* Desktop View Table */}
                    <div className="desktop-only" style={{ overflowX: 'auto' }}>
                      <table className="glass-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Borrower</th>
                            <th>Amount Collected</th>
                            <th>Security Code</th>
                            <th>Notes</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agentData.collectionHistory.map(tx => (
                            <tr key={tx.id}>
                              <td>{new Date(tx.payment_date).toLocaleString()}</td>
                              <td>{tx.borrower_name}</td>
                              <td style={{ color: 'var(--accent-emerald)', fontWeight: 'bold' }}>LKR {parseFloat(tx.amount).toLocaleString()}</td>
                              <td style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{tx.idempotency_key}</td>
                              <td>{tx.notes || '-'}</td>
                              <td>
                                <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '4px' }} onClick={() => {
                                  const loan = agentData.assignedLoans.find(l => l.id === tx.loan_id);
                                  handleOpenReceipt(tx, {
                                    borrowerPhone: loan?.borrower_phone,
                                    loanPrincipal: loan?.principal_amount,
                                    loanInterestRate: loan?.interest_rate,
                                    loanInterestType: loan?.interest_type,
                                    loanPrincipalOutstanding: loan?.principal_outstanding,
                                    loanInterestBalance: loan?.interest_balance
                                  });
                                }}>
                                  📄 Receipt
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile View Cards */}
                    <div className="mobile-only mobile-card-list">
                      {agentData.collectionHistory.map(tx => (
                        <div key={tx.id} className="mobile-row-card mobile-row-card-success">
                          <div className="mobile-row-card-header">
                            <span className="mobile-row-card-title">{tx.borrower_name}</span>
                            <span className="badge badge-active" style={{ color: 'var(--accent-emerald)' }}>LKR {parseFloat(tx.amount).toLocaleString()}</span>
                          </div>
                          <div className="mobile-row-card-grid">
                            <span className="mobile-row-card-label">Date</span>
                            <span className="mobile-row-card-value">{new Date(tx.payment_date).toLocaleDateString()}</span>
                            
                            <span className="mobile-row-card-label">Security Code</span>
                            <span className="mobile-row-card-value" style={{ fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{tx.idempotency_key}</span>
                          </div>
                          {tx.notes && (
                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '4px', fontSize: '14px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                              Notes: "{tx.notes}"
                            </div>
                          )}
                          <div className="mobile-row-card-actions">
                            <button type="button" className="glass-btn glass-btn-secondary" onClick={() => {
                              const loan = agentData.assignedLoans.find(l => l.id === tx.loan_id);
                              handleOpenReceipt(tx, {
                                borrowerPhone: loan?.borrower_phone,
                                loanPrincipal: loan?.principal_amount,
                                loanInterestRate: loan?.interest_rate,
                                loanInterestType: loan?.interest_type,
                                loanPrincipalOutstanding: loan?.principal_outstanding,
                                loanInterestBalance: loan?.interest_balance
                              });
                            }}>
                              📄 Print Receipt
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {agentSubView === 'remit' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="responsive-grid-equal-2-col">
                  <div className="kpi-card kpi-card-emerald">
                    <span className="kpi-lbl">Collected (All Time)</span>
                    <h3 className="kpi-val" style={{ color: 'var(--accent-emerald)' }}>LKR {(agentData.summary.totalCollected || 0).toLocaleString()}</h3>
                  </div>
                  <div className="kpi-card kpi-card-rose">
                    <span className="kpi-lbl">Cash Still In Hand</span>
                    <h3 className="kpi-val" style={{ color: 'var(--accent-rose)' }}>LKR {(agentData.summary.cashInHand || 0).toLocaleString()}</h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Collected minus what you've remitted to the office</span>
                  </div>
                </div>

                <div className="glass-card">
                  <h3 style={{ fontSize: '22px', marginBottom: '16px' }}>🏦 Remit Cash to Office</h3>
                  <form onSubmit={handleSubmitRemittance} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '420px' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Amount (LKR)</label>
                      <input type="number" min="1" required className="glass-input" placeholder="e.g. 20000"
                        value={remittanceForm.amount}
                        onChange={e => setRemittanceForm(prev => ({ ...prev, amount: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Notes</label>
                      <input type="text" className="glass-input" placeholder="e.g. Handed to admin at branch office"
                        value={remittanceForm.notes}
                        onChange={e => setRemittanceForm(prev => ({ ...prev, notes: e.target.value }))} />
                    </div>
                    <button type="submit" className="glass-btn glass-btn-emerald" disabled={loading}>Submit Remittance</button>
                  </form>
                </div>

                <div className="glass-card">
                  <h3 style={{ fontSize: '22px', marginBottom: '16px' }}>📜 My Remittance History</h3>
                  {remittances.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No remittances submitted yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {remittances.map(r => (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                          <div>
                            <div style={{ fontWeight: 'bold' }}>LKR {parseFloat(r.amount).toLocaleString()}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleString()} {r.notes ? `• ${r.notes}` : ''}</div>
                          </div>
                          <span className={`badge ${r.status === 'verified' ? 'badge-active' : 'badge-defaulted'}`}>{r.status === 'verified' ? 'Verified' : 'Pending'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ----------------- BORROWER PORTAL ----------------- */}
        {token && user && user.role === 'borrower' && view === 'dashboard' && borrowerData && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Summary widgets */}
            <div className="responsive-grid-equal-2-col">
              <div className="kpi-card kpi-card-rose">
                <span className="kpi-lbl" style={{ letterSpacing: '0.05em' }}>Outstanding Balance</span>
                <h3 className="kpi-val" style={{ color: 'var(--accent-rose)' }}>LKR {borrowerData.summary.totalOutstanding.toLocaleString()}</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Outstanding principal & accrued interest</span>
              </div>
              <div className="kpi-card kpi-card-emerald">
                <span className="kpi-lbl" style={{ letterSpacing: '0.05em' }}>Total Repayments Made</span>
                <h3 className="kpi-val" style={{ color: 'var(--accent-emerald)' }}>LKR {borrowerData.summary.totalPaid.toLocaleString()}</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Credited cash transfers</span>
              </div>
            </div>

            {/* List of active loans */}
            <div className="glass-card">
              <h3 style={{ fontSize: '24px', marginBottom: '16px' }}>💰 Your Loan Accounts</h3>
              {borrowerData.loans.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>You do not have any active loans.</p>
              ) : (
              <>
                {/* Desktop View Table */}
                <div className="desktop-only" style={{ overflowX: 'auto' }}>
                  <table className="glass-table">
                    <thead>
                      <tr>
                        <th>Disbursal Date</th>
                        <th>LKR Principal</th>
                        <th>Interest Rate</th>
                        <th>Accrual Frequency</th>
                        <th>Next Interest Posting</th>
                        <th>Principal Outstanding</th>
                        <th>Interest Due</th>
                        <th>Assigned collector Agent</th>
                        <th>Statement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {borrowerData.loans.map(loan => (
                        <tr key={loan.id}>
                          <td>{new Date(loan.created_at).toLocaleDateString()}</td>
                          <td>LKR {parseFloat(loan.principal_amount).toLocaleString()}</td>
                          <td>{loan.interest_rate}%</td>
                          <td style={{ textTransform: 'capitalize' }}>{loan.interest_type}</td>
                          <td>{new Date(loan.next_accrual_date).toLocaleDateString()}</td>
                          <td style={{ fontWeight: 'bold' }}>LKR {parseFloat(loan.principal_outstanding).toLocaleString()}</td>
                          <td style={{ fontWeight: 'bold' }}>LKR {parseFloat(loan.interest_balance).toLocaleString()}</td>
                          <td>{loan.agent_name || 'Lender Office Staff'}</td>
                          <td>
                            <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 10px', fontSize: '11px' }} onClick={() => viewStatement(loan.id)}>
                              View Ledger
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Cards */}
                <div className="mobile-only mobile-card-list">
                  {borrowerData.loans.map(loan => (
                    <div key={loan.id} className="mobile-row-card mobile-row-card-danger">
                      <div className="mobile-row-card-header">
                        <span className="mobile-row-card-title">Loan Disbursed</span>
                        <span className="badge badge-active" style={{ color: 'var(--accent-rose)' }}>Unpaid</span>
                      </div>
                      <div className="mobile-row-card-grid">
                        <span className="mobile-row-card-label">Date Given</span>
                        <span className="mobile-row-card-value">{new Date(loan.created_at).toLocaleDateString()}</span>
                        
                        <span className="mobile-row-card-label">Principal</span>
                        <span className="mobile-row-card-value">LKR {parseFloat(loan.principal_amount).toLocaleString()}</span>
                        
                        <span className="mobile-row-card-label">Interest</span>
                        <span className="mobile-row-card-value" style={{ textTransform: 'capitalize' }}>
                          {loan.interest_type} ({loan.interest_rate}%)
                        </span>
                        
                        <span className="mobile-row-card-label">Next Posting</span>
                        <span className="mobile-row-card-value">{new Date(loan.next_accrual_date).toLocaleDateString()}</span>
                        
                        <span className="mobile-row-card-label">Principal Due</span>
                        <span className="mobile-row-card-value" style={{ fontWeight: 'bold', color: 'var(--accent-rose)' }}>
                          LKR {parseFloat(loan.principal_outstanding).toLocaleString()}
                        </span>

                        <span className="mobile-row-card-label">Interest Due</span>
                        <span className="mobile-row-card-value" style={{ fontWeight: 'bold', color: 'var(--accent-rose)' }}>
                          LKR {parseFloat(loan.interest_balance).toLocaleString()}
                        </span>

                        <span className="mobile-row-card-label">Collector</span>
                        <span className="mobile-row-card-value">{loan.agent_name || 'Lender Office Staff'}</span>
                      </div>
                      <div className="mobile-row-card-actions">
                        <button className="glass-btn glass-btn-secondary" onClick={() => viewStatement(loan.id)}>
                          View Ledger
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
              )}
            </div>

            {/* Borrower Self-Payment Portal */}
            {borrowerData.loans.filter(l => l.status === 'active').length > 0 && (
              <div className="glass-card">
                <h3 style={{ fontSize: '24px', marginBottom: '8px' }}>💸 Submit Digital Repayment</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
                  Made a digital payment? Submit your bank transfer, mobile wallet, or card payment receipt details below for confirmation.
                </p>

                <form onSubmit={handleBorrowerPaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="form-grid-2-col">
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>SELECT LOAN ACCOUNT</label>
                      <select 
                        required 
                        className="glass-input" 
                        value={borrowerPayment.loan_id} 
                        onChange={e => setBorrowerPayment(prev => ({ ...prev, loan_id: e.target.value }))}
                      >
                        <option value="">-- Choose Account --</option>
                        {borrowerData.loans.filter(l => l.status === 'active').map(l => (
                          <option key={l.id} value={l.id}>
                            LKR {parseFloat(l.principal_amount).toLocaleString()} Loan (Principal: LKR {parseFloat(l.principal_outstanding).toLocaleString()}, Interest Due: LKR {parseFloat(l.interest_balance).toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>PAYMENT METHOD</label>
                      <select 
                        required 
                        className="glass-input" 
                        value={borrowerPayment.payment_method} 
                        onChange={e => setBorrowerPayment(prev => ({ ...prev, payment_method: e.target.value }))}
                      >
                        <option value="bank_transfer">🏦 Bank Transfer / Deposit</option>
                        <option value="mobile_wallet">📱 Mobile Wallet (eZ Cash / mCash)</option>
                        <option value="card">💳 Debit or Credit Card</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>PAYMENT TYPE</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="button"
                        className={`glass-btn ${borrowerPayment.payment_type === 'interest' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
                        style={{ flex: 1 }}
                        onClick={() => setBorrowerPayment(prev => ({ ...prev, payment_type: 'interest', amount: '' }))}>
                        Pay Interest
                      </button>
                      <button type="button"
                        className={`glass-btn ${borrowerPayment.payment_type === 'principal' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
                        style={{ flex: 1 }}
                        onClick={() => setBorrowerPayment(prev => ({ ...prev, payment_type: 'principal', amount: '' }))}>
                        Pay Principal
                      </button>
                    </div>
                  </div>

                  <div className="form-grid-2-col">
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>
                        {borrowerPayment.payment_type === 'interest' ? 'INTEREST AMOUNT (LKR)' : 'PRINCIPAL AMOUNT (LKR)'}
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        className="glass-input"
                        placeholder="Enter amount paid"
                        value={borrowerPayment.amount}
                        onChange={e => setBorrowerPayment(prev => ({ ...prev, amount: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>UPLOAD RECEIPT / SLIP PHOTO</label>
                      <input 
                        type="file" 
                        required 
                        accept="image/*" 
                        className="glass-input" 
                        onChange={handleBorrowerFileChange} 
                      />
                      {borrowerPayment.proof_image && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <img src={borrowerPayment.proof_image} alt="Receipt preview" style={{ width: '45px', height: '30px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-glass)' }} />
                          <span style={{ fontSize: '11px', color: 'var(--accent-emerald)' }}>✓ Slip Attached</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>ADDITIONAL NOTES (OPTIONAL)</label>
                    <textarea 
                      className="glass-input" 
                      rows="2" 
                      placeholder="e.g. Bank slip reference number, payment date/time..." 
                      value={borrowerPayment.notes} 
                      onChange={e => setBorrowerPayment(prev => ({ ...prev, notes: e.target.value }))} 
                    />
                  </div>

                  <div style={{ padding: '10px', background: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Security Code: <strong>{borrowerPayment.idempotency_key}</strong>
                  </div>

                  <button type="submit" className="glass-btn glass-btn-emerald" disabled={loading} style={{ padding: '14px' }}>
                    {loading ? 'Submitting payment...' : 'Submit Payment Request'}
                  </button>
                </form>
              </div>
            )}

            {/* Repayments History ledger */}
            <div className="glass-card">
              <h3 style={{ fontSize: '24px', marginBottom: '16px' }}>📜 Repayments Ledger History</h3>
              {borrowerData.payments.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No repayments recorded yet.</p>
              ) : (
              <>
                {/* Desktop View Table */}
                <div className="desktop-only" style={{ overflowX: 'auto' }}>
                  <table className="glass-table">
                    <thead>
                      <tr>
                        <th>Payment Date</th>
                        <th>Amount Received</th>
                        <th>Handed to Agent</th>
                        <th>Receipt ID</th>
                        <th>Notes</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {borrowerData.payments.map(p => (
                        <tr key={p.id}>
                          <td>{new Date(p.payment_date).toLocaleString()}</td>
                          <td style={{ color: 'var(--accent-emerald)', fontWeight: 'bold' }}>
                            LKR {parseFloat(p.amount).toLocaleString()}
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                              {p.payment_method ? p.payment_method.replace('_', ' ') : 'cash'}
                            </span>
                          </td>
                          <td>{p.agent_name}</td>
                          <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.id}</td>
                          <td>{p.notes || '-'}</td>
                          <td>
                            <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '4px' }} onClick={() => {
                              const loan = borrowerData.loans.find(l => l.id === p.loan_id);
                              handleOpenReceipt(p, {
                                borrowerName: user.name,
                                borrowerPhone: user.phone,
                                loanPrincipal: loan?.principal_amount,
                                loanInterestRate: loan?.interest_rate,
                                loanInterestType: loan?.interest_type,
                                loanPrincipalOutstanding: loan?.principal_outstanding,
                                loanInterestBalance: loan?.interest_balance
                              });
                            }}>
                              📄 Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Cards */}
                <div className="mobile-only mobile-card-list">
                  {borrowerData.payments.map(p => (
                    <div key={p.id} className="mobile-row-card mobile-row-card-success">
                      <div className="mobile-row-card-header">
                        <span className="mobile-row-card-title">Payment Collected</span>
                        <div style={{ textAlign: 'right' }}>
                          <span className="badge badge-active" style={{ color: 'var(--accent-emerald)', display: 'block' }}>LKR {parseFloat(p.amount).toLocaleString()}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{p.payment_method ? p.payment_method.replace('_', ' ') : 'cash'}</span>
                        </div>
                      </div>
                      <div className="mobile-row-card-grid">
                        <span className="mobile-row-card-label">Date Paid</span>
                        <span className="mobile-row-card-value">{new Date(p.payment_date).toLocaleDateString()}</span>
                        
                        <span className="mobile-row-card-label">Collector</span>
                        <span className="mobile-row-card-value">{p.agent_name}</span>
                        
                        <span className="mobile-row-card-label">Receipt ID</span>
                        <span className="mobile-row-card-value" style={{ fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{p.id}</span>
                      </div>
                      {p.notes && (
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '4px', fontSize: '14px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          Notes: "{p.notes}"
                        </div>
                      )}
                      <div className="mobile-row-card-actions">
                        <button type="button" className="glass-btn glass-btn-secondary" onClick={() => {
                          const loan = borrowerData.loans.find(l => l.id === p.loan_id);
                          handleOpenReceipt(p, {
                            borrowerName: user.name,
                            borrowerPhone: user.phone,
                            loanPrincipal: loan?.principal_amount,
                            loanInterestRate: loan?.interest_rate,
                            loanInterestType: loan?.interest_type,
                            loanPrincipalOutstanding: loan?.principal_outstanding,
                            loanInterestBalance: loan?.interest_balance
                          });
                        }}>
                          📄 Print Receipt
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
              )}
            </div>

            {/* Borrower Interest Accrual History */}
            <div className="glass-card">
              <h3 style={{ fontSize: '24px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📈</span> Your Interest Accrual Log
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
                Interest additions posted to your loan balance.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {['daily', 'weekly', 'monthly'].map(freq => {
                  const freqTotal = borrowerData.interestByType?.find(i => i.interest_type === freq)?.total || 0;
                  return (
                    <div key={freq} style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{freq} Charged</span>
                      <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px', color: 'var(--accent-rose)' }}>
                        LKR {parseFloat(freqTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </h4>
                    </div>
                  );
                })}
              </div>

              {!borrowerData.recentAccruals || borrowerData.recentAccruals.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No interest accrued yet.</p>
              ) : (
                <>
                  {/* Desktop View Table */}
                  <div className="desktop-only" style={{ overflowX: 'auto' }}>
                    <table className="glass-table">
                      <thead>
                        <tr>
                          <th>Date Accrued</th>
                          <th>Accrued Amount</th>
                          <th>Calculation Log (Formula Step)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {borrowerData.recentAccruals.map((acc, idx) => (
                          <tr key={idx}>
                            <td>{new Date(acc.created_at).toLocaleString()}</td>
                            <td style={{ color: 'var(--accent-rose)', fontWeight: 'bold' }}>+LKR {parseFloat(acc.amount_accrued).toLocaleString()}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '14px', color: 'var(--text-secondary)' }}>{acc.calculation_log}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View Cards */}
                  <div className="mobile-only mobile-card-list">
                    {borrowerData.recentAccruals.map((acc, idx) => (
                      <div key={idx} className="mobile-row-card mobile-row-card-danger">
                        <div className="mobile-row-card-header">
                          <strong style={{ fontSize: '15px' }}>Interest Accrued</strong>
                          <span style={{ color: 'var(--accent-rose)', fontWeight: 'bold' }}>+LKR {parseFloat(acc.amount_accrued).toLocaleString()}</span>
                        </div>
                        <div className="mobile-row-card-grid-compact">
                          <div>
                            <span className="mobile-row-card-label">Date:</span>
                            <span className="mobile-row-card-value">{new Date(acc.created_at).toLocaleDateString()}</span>
                          </div>
                          <div style={{ gridColumn: 'span 2' }}>
                            <span className="mobile-row-card-label">Log:</span>
                            <span className="mobile-row-card-value" style={{ fontFamily: 'monospace', fontSize: '13px' }}>{acc.calculation_log}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

          </div>
        )}

        {/* ----------------- DOUBLE-ENTRY STATEMENT AUDIT LEDGER ----------------- */}
        {token && user && view === 'ledger' && loanStatement && (() => {
          // Construct passbook events chronologically. Interest-only model —
          // principal and interest are two separate running balances:
          // disbursement/principal-payments only move the principal balance,
          // accruals/penalties/interest-payments only move the interest balance.
          const events = [
            {
              date: loanStatement.loan.created_at,
              type: 'Loan Disbursed',
              amount: parseFloat(loanStatement.loan.principal_amount),
              bucket: 'principal',
              change: 'increase',
              details: 'Initial principal loan amount'
            },
            ...loanStatement.accruals.map(acc => ({
              date: acc.created_at,
              type: 'Interest Added',
              amount: parseFloat(acc.amount_accrued),
              bucket: 'interest',
              change: 'increase',
              details: `Interest charged (${acc.calculation_log.split('|')[1]?.trim() || ''})`
            })),
            ...loanStatement.payments.map(p => ({
              date: p.payment_date,
              type: p.payment_type === 'principal' ? 'Principal Payment' : 'Interest Payment',
              amount: parseFloat(p.amount),
              bucket: p.payment_type === 'principal' ? 'principal' : 'interest',
              change: 'decrease',
              details: `Cash collected by ${p.agent_name} ${p.notes ? ` - "${p.notes}"` : ''}`
            })),
            ...loanStatement.ledger.filter(l => l.account === 'penalty_revenue').map(l => ({
              date: l.created_at,
              type: 'Penalty Applied',
              amount: parseFloat(l.amount),
              bucket: 'interest',
              change: 'increase',
              details: 'Manual late fee / penalty charged by admin'
            }))
          ];

          // Sort chronologically (oldest first)
          events.sort((a, b) => new Date(a.date) - new Date(b.date));

          // Compute the two running balances in parallel
          let principalBal = 0;
          let interestBal = 0;
          const eventsWithBalance = events.map(ev => {
            const delta = ev.change === 'increase' ? ev.amount : -ev.amount;
            if (ev.bucket === 'principal') {
              principalBal += delta;
            } else {
              interestBal += delta;
            }
            return { ...ev, runningPrincipalBalance: principalBal, runningInterestBalance: interestBal };
          });

          // Reverse chronological for list rendering (newest first)
          const displayEvents = [...eventsWithBalance].reverse();

          return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Header info card */}
              <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 'bold', letterSpacing: '0.05em' }}>LOAN STATEMENT & HISTORY</span>
                  <h2 style={{ fontSize: '28px', margin: '4px 0' }}>Loan Details: {loanStatement.loan.borrower_name}</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '6px' }}>
                    Original Principal: <strong>LKR {parseFloat(loanStatement.loan.principal_amount).toLocaleString()}</strong> |{' '}
                    Principal Outstanding: <strong style={{ color: 'var(--accent-rose)' }}>LKR {parseFloat(loanStatement.loan.principal_outstanding).toLocaleString()}</strong> |{' '}
                    Interest Due: <strong style={{ color: 'var(--accent-rose)' }}>LKR {parseFloat(loanStatement.loan.interest_balance).toLocaleString()}</strong>
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', margin: '0' }}>
                    <span>🪪 NIC Number: <strong>{loanStatement.loan.nic_number || 'N/A'}</strong></span>
                    {loanStatement.loan.nic_photo_url && (
                      <>
                        <span>•</span>
                        <a 
                          href="#" 
                          style={{ color: 'var(--accent-blue)', textDecoration: 'underline', fontWeight: '500' }}
                          onClick={(e) => {
                            e.preventDefault();
                            const win = window.open();
                            const fullUrl = loanStatement.loan.nic_photo_url.startsWith('http') 
                              ? loanStatement.loan.nic_photo_url 
                              : `http://localhost:5000${loanStatement.loan.nic_photo_url}`;
                            win.document.write(`<img src="${fullUrl}" style="max-width:100%; height:auto; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border-radius: 8px;" />`);
                          }}
                        >
                          View NIC Photo
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <button className="glass-btn" onClick={() => { setView('dashboard'); setSelectedLoanId(null); setLoanStatement(null); }}>
                  ⬅️ Go Back
                </button>
              </div>

              {/* Admin-only loan lifecycle controls */}
              {user.role === 'admin' && loanStatement.loan.status === 'active' && (
                <div className="glass-card">
                  <h3 style={{ fontSize: '22px', marginBottom: '16px' }}>⚙️ Loan Management</h3>
                  <div className="responsive-grid-2-col" style={{ gap: '20px' }}>
                    <div>
                      <h4 style={{ fontSize: '15px', marginBottom: '10px' }}>Edit Terms</h4>
                      <form onSubmit={handleUpdateLoan} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 'bold' }}>New Interest Rate (%) — currently {loanStatement.loan.interest_rate}%</label>
                          <input type="number" step="0.01" min="0" className="glass-input" placeholder="Leave blank to keep unchanged"
                            value={loanEditForm.interest_rate}
                            onChange={e => setLoanEditForm(prev => ({ ...prev, interest_rate: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Reassign Agent</label>
                          <select className="glass-input" value={loanEditForm.assigned_agent_id}
                            onChange={e => setLoanEditForm(prev => ({ ...prev, assigned_agent_id: e.target.value }))}>
                            <option value="">Leave unchanged</option>
                            {agentsList.map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                        </div>
                        <button type="submit" className="glass-btn glass-btn-secondary" disabled={loading}>Save Changes</button>
                      </form>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '15px', marginBottom: '10px' }}>Apply Late Fee / Penalty</h4>
                      <form onSubmit={handleApplyPenalty} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input type="number" min="1" className="glass-input" placeholder="Penalty amount (LKR)"
                          value={penaltyForm.amount}
                          onChange={e => setPenaltyForm(prev => ({ ...prev, amount: e.target.value }))} />
                        <input type="text" className="glass-input" placeholder="Reason (optional)"
                          value={penaltyForm.reason}
                          onChange={e => setPenaltyForm(prev => ({ ...prev, reason: e.target.value }))} />
                        <button type="submit" className="glass-btn glass-btn-secondary" disabled={loading}>Apply Penalty</button>
                      </form>

                      <h4 style={{ fontSize: '15px', margin: '16px 0 10px' }}>Mark as Defaulted</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input type="text" className="glass-input" placeholder="Reason for default (required)"
                          value={defaultReason}
                          onChange={e => setDefaultReason(e.target.value)} />
                        <button type="button" className="glass-btn glass-btn-rose" disabled={loading} onClick={() => {
                          if (window.confirm('Mark this loan as defaulted? This will block further payment collection.')) {
                            handleMarkDefaulted();
                          }
                        }}>
                          🚫 Mark Defaulted
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Guarantor Details (only for loans that recorded one) */}
              {loanStatement.guarantor && (
                <div className="glass-card">
                  <h3 style={{ fontSize: '22px', marginBottom: '16px' }}>🛡️ Guarantor Details</h3>
                  <div className="responsive-grid-2-col" style={{ rowGap: '10px' }}>
                    <div><strong>Name:</strong> {loanStatement.guarantor.full_name}</div>
                    <div><strong>NIC:</strong> {loanStatement.guarantor.nic_number}</div>
                    <div><strong>Phone:</strong> {loanStatement.guarantor.phone}</div>
                    <div><strong>Email:</strong> {loanStatement.guarantor.email || '-'}</div>
                    <div><strong>Gender:</strong> {loanStatement.guarantor.gender || '-'}</div>
                    <div><strong>Ethnicity:</strong> {loanStatement.guarantor.ethnicity || '-'}</div>
                    <div><strong>Date of Birth:</strong> {loanStatement.guarantor.date_of_birth ? new Date(loanStatement.guarantor.date_of_birth).toLocaleDateString() : '-'}</div>
                    <div style={{ gridColumn: '1 / -1' }}><strong>Address:</strong> {loanStatement.guarantor.address}</div>
                    <div>
                      <strong>Protected under debt-recovery act:</strong>{' '}
                      <span style={{ color: loanStatement.guarantor.protected_under_debt_act ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                        {loanStatement.guarantor.protected_under_debt_act ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div>
                      <strong>Pending court cases:</strong>{' '}
                      <span style={{ color: loanStatement.guarantor.has_pending_court_cases ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                        {loanStatement.guarantor.has_pending_court_cases ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginTop: '14px', display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '14px' }}>
                    <div>
                      <strong>Monthly Income:</strong> LKR {(
                        parseFloat(loanStatement.guarantor.monthly_income_business || 0) +
                        parseFloat(loanStatement.guarantor.monthly_income_agriculture || 0) +
                        parseFloat(loanStatement.guarantor.monthly_income_other || 0)
                      ).toLocaleString()}
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}> (Business: {parseFloat(loanStatement.guarantor.monthly_income_business || 0).toLocaleString()}, Agriculture: {parseFloat(loanStatement.guarantor.monthly_income_agriculture || 0).toLocaleString()}, Other: {parseFloat(loanStatement.guarantor.monthly_income_other || 0).toLocaleString()})</span>
                    </div>
                    <div>
                      <strong>Monthly Expense:</strong> LKR {(
                        parseFloat(loanStatement.guarantor.monthly_expense_food || 0) +
                        parseFloat(loanStatement.guarantor.monthly_expense_rent || 0) +
                        parseFloat(loanStatement.guarantor.monthly_expense_other || 0)
                      ).toLocaleString()}
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}> (Food: {parseFloat(loanStatement.guarantor.monthly_expense_food || 0).toLocaleString()}, Rent: {parseFloat(loanStatement.guarantor.monthly_expense_rent || 0).toLocaleString()}, Other: {parseFloat(loanStatement.guarantor.monthly_expense_other || 0).toLocaleString()})</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary columns grid */}
              <div className="responsive-grid-2-col">

                {/* Passbook Statement History */}
                <div className="glass-card">
                  <h3 style={{ fontSize: '22px', marginBottom: '16px' }}>🧾 Passbook Statement (Activity Log)</h3>
                  
                  {/* Desktop View Table */}
                  <div className="desktop-only" style={{ overflowX: 'auto' }}>
                    <table className="glass-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Activity</th>
                          <th>Details</th>
                          <th>Amount (+ / -)</th>
                          <th>Principal Bal.</th>
                          <th>Interest Bal.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayEvents.map((entry, idx) => (
                          <tr key={idx}>
                            <td>{new Date(entry.date).toLocaleString()}</td>
                            <td>
                              <span className={`badge ${entry.change === 'decrease' ? 'badge-active' : 'badge-pending'}`}>
                                {entry.type}
                              </span>
                            </td>
                            <td style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{entry.details}</td>
                            <td style={{
                              fontWeight: 'bold',
                              color: entry.change === 'decrease' ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                            }}>
                              {entry.change === 'increase' ? `+ LKR ${entry.amount.toLocaleString()}` : `- LKR ${entry.amount.toLocaleString()}`}
                            </td>
                            <td style={{ fontWeight: 'bold' }}>
                              LKR {entry.runningPrincipalBalance.toLocaleString()}
                            </td>
                            <td style={{ fontWeight: 'bold' }}>
                              LKR {entry.runningInterestBalance.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View Cards */}
                  <div className="mobile-only mobile-card-list">
                    {displayEvents.map((entry, idx) => (
                      <div key={idx} className={`mobile-row-card ${entry.change === 'decrease' ? 'mobile-row-card-success' : 'mobile-row-card-warning'}`}>
                        <div className="mobile-row-card-header">
                          <strong style={{ fontSize: '15px' }}>{entry.type}</strong>
                          <span className={`badge ${entry.change === 'decrease' ? 'badge-active' : 'badge-pending'}`}>
                            {entry.change === 'increase' ? 'Charged' : 'Paid'}
                          </span>
                        </div>
                        <div className="mobile-row-card-grid-compact">
                          <div>
                            <span className="mobile-row-card-label">Date:</span>
                            <span className="mobile-row-card-value">{new Date(entry.date).toLocaleDateString()}</span>
                          </div>
                          <div>
                            <span className="mobile-row-card-label">Change:</span>
                            <span className="mobile-row-card-value" style={{ 
                              fontWeight: 'bold', 
                              color: entry.change === 'decrease' ? 'var(--accent-emerald)' : 'var(--accent-rose)' 
                            }}>
                              {entry.change === 'increase' ? `+ LKR ${entry.amount.toLocaleString()}` : `- LKR ${entry.amount.toLocaleString()}`}
                            </span>
                          </div>
                          <div style={{ gridColumn: 'span 2' }}>
                            <span className="mobile-row-card-label">Description:</span>
                            <span className="mobile-row-card-value" style={{ fontSize: '13px' }}>{entry.details}</span>
                          </div>
                          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '4px', marginTop: '4px' }}>
                            <span className="mobile-row-card-label">Principal Bal:</span>
                            <span className="mobile-row-card-value" style={{ fontWeight: 'bold' }}> LKR {entry.runningPrincipalBalance.toLocaleString()}</span>
                          </div>
                          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '4px', marginTop: '4px' }}>
                            <span className="mobile-row-card-label">Interest Bal:</span>
                            <span className="mobile-row-card-value" style={{ fontWeight: 'bold' }}> LKR {entry.runningInterestBalance.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payments & Interest History split */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  
                  {/* Collection Receipts ledger */}
                  <div className="glass-card">
                    <h3 style={{ fontSize: '22px', marginBottom: '16px' }}>💵 Payments Received</h3>
                    {loanStatement.payments.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No payments collected yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {loanStatement.payments.map((p, idx) => (
                          <div key={idx} style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                              <span>Received by {p.agent_name}</span>
                              <span style={{ color: 'var(--text-muted)' }}>{new Date(p.payment_date).toLocaleDateString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ color: 'var(--accent-emerald)', fontSize: '15px' }}>LKR {parseFloat(p.amount).toLocaleString()}</strong>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px' }} onClick={() => {
                                  handleOpenReceipt(p, {
                                    borrowerName: loanStatement.loan.borrower_name,
                                    borrowerPhone: loanStatement.loan.borrower_phone,
                                    loanPrincipal: loanStatement.loan.principal_amount,
                                    loanInterestRate: loanStatement.loan.interest_rate,
                                    loanInterestType: loanStatement.loan.interest_type,
                                    loanPrincipalOutstanding: loanStatement.loan.principal_outstanding,
                                    loanInterestBalance: loanStatement.loan.interest_balance
                                  });
                                }}>
                                  🖨️ Print
                                </button>
                                {p.proof_image_url && (
                                  <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px' }} onClick={() => {
                                    const win = window.open();
                                    win.document.write(`<img src="${p.proof_image_url}" style="max-width:100%; height:auto;" />`);
                                  }}>
                                    Photo
                                  </button>
                                )}
                              </div>
                            </div>
                            {p.notes && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>"{p.notes}"</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Accrued Interest list */}
                  <div className="glass-card">
                    <h3 style={{ fontSize: '22px', marginBottom: '16px' }}>📈 Interest Charged History</h3>
                    {loanStatement.accruals.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No interest accrued yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {loanStatement.accruals.map((acc, idx) => (
                          <div key={idx} style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                              <span>Accrued Date</span>
                              <span>{new Date(acc.created_at).toLocaleDateString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <strong style={{ color: 'var(--accent-gold)' }}>+LKR {parseFloat(acc.amount_accrued).toLocaleString()}</strong>
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'monospace' }}>{acc.calculation_log}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

              </div>

            </div>
          );
        })()}

      </main>

      {/* Sticky Bottom Navigation Bar */}
      {token && user && (
        <nav className="bottom-nav-bar animate-fade-in">
          {user.role === 'admin' && (
            <>
              <button className={`bottom-nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setSelectedLoanId(null); setLoanStatement(null); }}>
                <span className="bottom-nav-icon">🏠</span>
                <span className="bottom-nav-label">Home</span>
              </button>
              <button className={`bottom-nav-item ${view === 'create-loan' ? 'active' : ''}`} onClick={() => { setView('create-loan'); setSelectedLoanId(null); setLoanStatement(null); }}>
                <span className="bottom-nav-icon">💵</span>
                <span className="bottom-nav-label">Give Loan</span>
              </button>
              <button className={`bottom-nav-item ${view === 'loans' ? 'active' : ''}`} onClick={() => { setView('loans'); setSelectedLoanId(null); setLoanStatement(null); }}>
                <span className="bottom-nav-icon">📋</span>
                <span className="bottom-nav-label">Check Loans</span>
              </button>
              <button className={`bottom-nav-item ${view === 'agents' ? 'active' : ''}`} onClick={() => { setView('agents'); setSelectedLoanId(null); setLoanStatement(null); }}>
                <span className="bottom-nav-icon">👥</span>
                <span className="bottom-nav-label">Agent Route</span>
              </button>
              <button className={`bottom-nav-item ${view === 'admin-tools' ? 'active' : ''}`} onClick={openAdminTools}>
                <span className="bottom-nav-icon">🏦</span>
                <span className="bottom-nav-label">Cash & Tools</span>
              </button>
            </>
          )}
          {user.role === 'agent' && (
            <>
              <button className={`bottom-nav-item ${agentSubView === 'collect' ? 'active' : ''}`} onClick={() => setAgentSubView('collect')}>
                <span className="bottom-nav-icon">💵</span>
                <span className="bottom-nav-label">Collect</span>
              </button>
              <button className={`bottom-nav-item ${agentSubView === 'history' ? 'active' : ''}`} onClick={() => setAgentSubView('history')}>
                <span className="bottom-nav-icon">📜</span>
                <span className="bottom-nav-label">History</span>
              </button>
              <button className={`bottom-nav-item ${agentSubView === 'remit' ? 'active' : ''}`} onClick={() => setAgentSubView('remit')}>
                <span className="bottom-nav-icon">🏦</span>
                <span className="bottom-nav-label">Remit</span>
              </button>
            </>
          )}
          {user.role === 'borrower' && (
            <>
              <button className="bottom-nav-item active">
                <span className="bottom-nav-icon">💰</span>
                <span className="bottom-nav-label">My Loans</span>
              </button>
            </>
          )}
        </nav>
      )}
    </div>
  );
}

// Subcomponent to load all loans in Admin view with Search & Filters
function LoansLoader({ onSelect, fetchTrigger }) {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'fully_paid'

  useEffect(() => {
    setLoading(true);
    api.get('/loans')
      .then(data => setLoans(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [fetchTrigger]);

  if (loading) return <p style={{ color: 'var(--text-secondary)', fontSize: '14px', padding: '16px' }}>Loading loan records...</p>;

  // Filter loans based on search and status selector
  const filteredLoans = loans.filter(loan => {
    const matchesSearch = 
      loan.borrower_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      loan.borrower_phone.includes(searchTerm);
    const matchesFilter = statusFilter === 'all' || loan.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="glass-card" style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '24px' }}>📋 Loan List</h3>
        
        {/* Simple Search Input */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', maxWidth: '300px' }}>
          <input 
            type="text" 
            className="glass-input" 
            placeholder="🔍 Search name or phone..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ padding: '8px 12px' }}
          />
        </div>
      </div>

      {/* Solid filter buttons (easily approachable) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button 
          type="button" 
          className={`glass-btn ${statusFilter === 'all' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`} 
          style={{ padding: '6px 12px', fontSize: '12px' }}
          onClick={() => setStatusFilter('all')}
        >
          All ({loans.length})
        </button>
        <button 
          type="button" 
          className={`glass-btn ${statusFilter === 'active' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`} 
          style={{ padding: '6px 12px', fontSize: '12px' }}
          onClick={() => setStatusFilter('active')}
        >
          Active Loans ({loans.filter(l => l.status === 'active').length})
        </button>
        <button 
          type="button" 
          className={`glass-btn ${statusFilter === 'fully_paid' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`} 
          style={{ padding: '6px 12px', fontSize: '12px' }}
          onClick={() => setStatusFilter('fully_paid')}
        >
          Fully Paid ({loans.filter(l => l.status === 'fully_paid').length})
        </button>
      </div>

      {filteredLoans.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', padding: '16px 0', fontSize: '14px' }}>No matching loans found.</p>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="desktop-only" style={{ overflowX: 'auto' }}>
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Date Given</th>
                  <th>Borrower</th>
                  <th>Loan Amount</th>
                  <th>Interest Type</th>
                  <th>Rate</th>
                  <th>Principal Outstanding</th>
                  <th>Interest Due</th>
                  <th>Collection Agent</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map(loan => (
                  <tr key={loan.id}>
                    <td>{new Date(loan.created_at).toLocaleDateString()}</td>
                    <td>
                      <strong style={{ display: 'block' }}>{loan.borrower_name}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>📞 {loan.borrower_phone}</span>
                      {loan.nic_number && <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>🪪 NIC: {loan.nic_number}</span>}
                    </td>
                    <td>LKR {parseFloat(loan.principal_amount).toLocaleString()}</td>
                    <td style={{ textTransform: 'capitalize' }}>{loan.interest_type}</td>
                    <td>{loan.interest_rate}%</td>
                    <td style={{ fontWeight: 'bold', color: 'var(--accent-rose)' }}>LKR {parseFloat(loan.principal_outstanding).toLocaleString()}</td>
                    <td style={{ fontWeight: 'bold', color: 'var(--accent-rose)' }}>LKR {parseFloat(loan.interest_balance).toLocaleString()}</td>
                    <td>{loan.agent_name || 'Lender Office Staff'}</td>
                    <td>
                      <span className={`badge ${loan.status === 'active' ? 'badge-active' : loan.status === 'fully_paid' ? 'badge-paid' : 'badge-defaulted'}`}>
                        {loan.status === 'active' ? 'Unpaid' : loan.status === 'fully_paid' ? 'Paid' : loan.status}
                      </span>
                    </td>
                    <td>
                      <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => onSelect(loan.id)}>
                        Check Loan Account
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="mobile-only mobile-card-list">
            {filteredLoans.map(loan => (
              <div 
                key={loan.id} 
                className={`mobile-row-card ${loan.status === 'active' ? 'mobile-row-card-warning' : loan.status === 'fully_paid' ? 'mobile-row-card-success' : 'mobile-row-card-danger'}`}
                onClick={() => onSelect(loan.id)}
                style={{ cursor: 'pointer', transition: 'transform 0.1s ease, box-shadow 0.1s ease' }}
              >
                <div className="mobile-row-card-header">
                  <div>
                    <strong className="mobile-row-card-title" style={{ display: 'block' }}>{loan.borrower_name}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>📞 {loan.borrower_phone}</span>
                    {loan.nic_number && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>🪪 NIC: {loan.nic_number}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`badge ${loan.status === 'active' ? 'badge-active' : loan.status === 'fully_paid' ? 'badge-paid' : 'badge-defaulted'}`}>
                      {loan.status === 'active' ? 'Unpaid' : loan.status === 'fully_paid' ? 'Paid' : loan.status}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '16px' }}>➔</span>
                  </div>
                </div>
                <div className="mobile-row-card-grid-compact">
                  <div>
                    <span className="mobile-row-card-label">Principal:</span>
                    <span className="mobile-row-card-value"> LKR {parseFloat(loan.principal_amount).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="mobile-row-card-label">Given:</span>
                    <span className="mobile-row-card-value"> {new Date(loan.created_at).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="mobile-row-card-label">Interest:</span>
                    <span className="mobile-row-card-value" style={{ textTransform: 'capitalize' }}> {loan.interest_type} ({loan.interest_rate}%)</span>
                  </div>
                  <div>
                    <span className="mobile-row-card-label">Principal Due:</span>
                    <span className="mobile-row-card-value" style={{ fontWeight: 'bold', color: 'var(--accent-rose)' }}> LKR {parseFloat(loan.principal_outstanding).toLocaleString()}</span>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span className="mobile-row-card-label">Interest Due:</span>
                    <span className="mobile-row-card-value" style={{ fontWeight: 'bold', color: 'var(--accent-rose)' }}> LKR {parseFloat(loan.interest_balance).toLocaleString()}</span>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span className="mobile-row-card-label">Collector:</span>
                    <span className="mobile-row-card-value"> {loan.agent_name || 'Lender Office Staff'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Quick placeholder lists
function AllLoansTable() {
  return null;
}
