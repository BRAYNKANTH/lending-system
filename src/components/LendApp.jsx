'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/apiClient.js';
import {
  Home, Banknote, ClipboardList, Users, Landmark, KeyRound, LogOut,
  ArrowLeft, ArrowRight, ScrollText, Check, X, Phone, IdCard, ShieldCheck,
  Printer, FileText, TrendingUp, Bell, BarChart3, Zap, AlertTriangle,
  Briefcase, Truck, BookOpen, ArrowDown, User, Settings, Ban, Receipt,
  Search, CreditCard, Smartphone, PiggyBank, UserPlus, Trash2, ClipboardCheck,
  CircleCheck, CircleAlert, RefreshCcw, Download, ChevronRight
} from 'lucide-react';

export default function LendApp() {
  const [token, setToken] = useState(localStorage.getItem('lend_token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('lend_user')));
  const [view, setView] = useState('dashboard'); // 'dashboard', 'loans', 'ledger'
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'loans', 'agents'
  const [agentSubView, setAgentSubView] = useState('collect'); // 'collect', 'history'
  const [agentCustomerTab, setAgentCustomerTab] = useState('active'); // 'active', 'defaulted', 'closed'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Real-time toast notifications list
  const [toastAlerts, setToastAlerts] = useState([]);

  // Data storage
  const [adminData, setAdminData] = useState(null);
  const [agentData, setAgentData] = useState(null);
  const [borrowersList, setBorrowersList] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [selectedLoanId, setSelectedLoanId] = useState(null);
  const [loanStatement, setLoanStatement] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showLoanAgreement, setShowLoanAgreement] = useState(false);
  const [backfillDate, setBackfillDate] = useState('');

  // Admin: Cash & Tools view data (users, remittances, ledger report)
  const [adminUsers, setAdminUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ name: '', phone: '', email: '', gender: '', role: 'agent', password: '' });
  const [remittances, setRemittances] = useState([]);
  const [ledgerReport, setLedgerReport] = useState(null);
  const [ledgerFrom, setLedgerFrom] = useState('');
  const [ledgerTo, setLedgerTo] = useState('');
  const [cashReconciliation, setCashReconciliation] = useState(null);

  // Agent: cash remittance submission form
  const [remittanceForm, setRemittanceForm] = useState({ amount: '', notes: '' });

  // Change password & settings modal (all roles)
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile');
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '', gender: '' });

  // Admin: loan edit/default/penalty controls on the statement view
  const [loanEditForm, setLoanEditForm] = useState({ interest_rate: '', assigned_agent_id: '' });
  const [defaultReason, setDefaultReason] = useState('');
  const [penaltyForm, setPenaltyForm] = useState({ amount: '', reason: '' });

  // Form states
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [newLoan, setNewLoan] = useState({
    borrower_name: '',
    borrower_phone: '',
    borrower_address: '',
    borrower_email: '',
    borrower_gender: '',
    principal_amount: '',
    interest_rate: '2.00',
    interest_type: 'daily',
    assigned_agent_id: '',
    nic_number: '',
    nic_photo: '',
    collection_mode: 'open_ended',
    duration_periods: ''
  });
  const [includeGuarantor, setIncludeGuarantor] = useState(false);
  const emptyGuarantor = {
    full_name: '', nic_number: '', gender: '', ethnicity: '',
    address: '', phone: '',
    protected_under_debt_act: false, has_pending_court_cases: false,
    monthly_income_business: '', monthly_income_agriculture: '', monthly_income_other: '',
    monthly_expense_food: '', monthly_expense_rent: '', monthly_expense_other: ''
  };
  const [guarantorForm, setGuarantorForm] = useState(emptyGuarantor);
  const [giveLoanStep, setGiveLoanStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState({});
  const [ledgerTab, setLedgerTab] = useState('passbook');

  const clearFieldError = (field) => {
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  // Editing/adding a guarantor on an EXISTING loan (loan statement page),
  // separate from the create-loan form above.
  const [showGuarantorEditor, setShowGuarantorEditor] = useState(false);
  const [guarantorEditForm, setGuarantorEditForm] = useState(emptyGuarantor);

  // Editing user details (Admin only)
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ name: '', phone: '', role: '' });

  // Borrower profile details are collected for every loan now (not
  // optional) — loan purpose, dependents, and monthly income are required;
  // spouse details stay optional since not every borrower has a spouse.
  const emptyBorrowerProfile = {
    loan_purpose: '', dependents_count: '', monthly_income: '',
    spouse_name: '', spouse_nic: '', spouse_occupation: ''
  };
  const [borrowerProfileForm, setBorrowerProfileForm] = useState(emptyBorrowerProfile);

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

  const [ledgerPaymentForm, setLedgerPaymentForm] = useState({
    payment_type: 'interest',
    amount: '',
    notes: '',
    proof_image: '',
    payment_method: 'cash',
    idempotency_key: ''
  });

  // Borrower dashboard and payment forms
  const [borrowerData, setBorrowerData] = useState(null);
  const [borrowerPayment, setBorrowerPayment] = useState({
    loan_id: '',
    payment_type: 'interest',
    amount: '',
    notes: '',
    proof_image: '',
    payment_method: 'bank_transfer',
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
        resetBorrowerPaymentForm(data.loans?.find(l => l.status === 'active')?.id || data.loans?.[0]?.id || '');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetBorrowerPaymentForm = (loanId) => {
    setBorrowerPayment({
      loan_id: loanId || '',
      payment_type: 'interest',
      amount: '',
      notes: '',
      proof_image: '',
      payment_method: 'bank_transfer',
      idempotency_key: 'idemp_borr_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now()
    });
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
        api.get('/users?role=admin,agent,borrower'),
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
        api.get('/users?role=admin,agent,borrower'),
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

  // Re-fetch just the ledger report with the selected date range — the API
  // has always supported from/to, but the UI never exposed it, so admins
  // could only ever see an all-time trial balance, never a monthly one.
  const handleFetchLedgerReport = async (overrideFrom, overrideTo) => {
    const from = overrideFrom !== undefined ? overrideFrom : ledgerFrom;
    const to = overrideTo !== undefined ? overrideTo : ledgerTo;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const query = params.toString();
      const ledger = await api.get(`/reports/ledger${query ? `?${query}` : ''}`);
      setLedgerReport(ledger);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRemittance = async (id) => {
    setLoading(true);
    setError('');
    try {
      await api.patch(`/remittances/${id}/verify`, {});
      showToast('Cash handover verified.');
      refreshAdminTools();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRemittance = async (id) => {
    const reason = window.prompt('Reason for rejecting this cash handover (e.g. cash never arrived):');
    if (reason === null) return; // cancelled
    if (!reason.trim()) {
      setError('A reason is required to reject a cash handover.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.patch(`/remittances/${id}/reject`, { reason });
      showToast('Cash handover rejected — reversed onto the agent\'s outstanding cash-in-hand.');
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

  const handleStartEditUser = (targetUser) => {
    setEditingUser(targetUser);
    setEditUserForm({
      name: targetUser.name || '',
      phone: targetUser.phone || '',
      role: targetUser.role || '',
      email: targetUser.email || '',
      gender: targetUser.gender || ''
    });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    setError('');
    try {
      await api.patch(`/users/${editingUser.id}`, {
        name: editUserForm.name,
        phone: editUserForm.phone,
        role: editUserForm.role,
        email: editUserForm.email || '',
        gender: editUserForm.gender || ''
      });
      showToast(`User ${editUserForm.name} updated successfully.`);
      setEditingUser(null);
      refreshAdminTools();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api.post('/auth/register', {
        name: newUserForm.name,
        phone: newUserForm.phone,
        email: newUserForm.email || undefined,
        gender: newUserForm.gender || undefined,
        role: newUserForm.role,
        password: newUserForm.password || undefined
      });
      showToast(
        result.temporaryPassword
          ? `${newUserForm.name} added as ${newUserForm.role}. Temporary password: ${result.temporaryPassword}`
          : `${newUserForm.name} added as ${newUserForm.role}.`
      );
      setNewUserForm({ name: '', phone: '', email: '', gender: '', role: 'agent', password: '' });
      setShowAddUser(false);
      refreshAdminTools();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (!window.confirm(`Permanently delete ${targetUser.name}? This can't be undone. Users with loan/payment history can't be deleted — deactivate them instead.`)) {
      return;
    }
    const password = window.prompt(`Please enter your admin password to authorize deleting ${targetUser.name}:`);
    if (password === null) return;
    if (!password) {
      showToast('Password is required to delete a user.', 'error');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.delete(`/users/${targetUser.id}?password=${encodeURIComponent(password)}`);
      showToast(`${targetUser.name} deleted.`);
      refreshAdminTools();
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

  const downloadRemittancesCsv = () => {
    if (!remittances.length) return;
    downloadCsv(
      `cash-handovers-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Agent', 'Amount', 'Status', 'Notes', 'Verified/Rejected By', 'Verified/Rejected At'],
      remittances.map(r => [
        new Date(r.created_at).toLocaleString(),
        r.agent_name,
        parseFloat(r.amount).toFixed(2),
        r.status,
        r.notes || '',
        r.verified_by_name || '',
        r.verified_at ? new Date(r.verified_at).toLocaleString() : ''
      ])
    );
  };

  // Agent: submit a cash handover to the office
  const handleSubmitRemittance = async (e) => {
    e.preventDefault();
    if (!remittanceForm.amount || parseFloat(remittanceForm.amount) <= 0) {
      setError('Please enter a valid cash handover amount.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/remittances', { amount: parseFloat(remittanceForm.amount), notes: remittanceForm.notes });
      showToast(`LKR ${parseFloat(remittanceForm.amount).toLocaleString()} cash handover submitted to the office.`);
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

  // Open settings panel prefilled with profile info
  const handleOpenSettings = () => {
    setProfileForm({
      name: user?.name || '',
      phone: user?.phone || '',
      email: user?.email || '',
      gender: user?.gender || ''
    });
    setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    setSettingsTab('profile');
    setShowSettings(true);
  };

  // Submit profile self-updates
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify(profileForm)
      });
      const updatedUser = { ...user, ...profileForm };
      localStorage.setItem('lend_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      showToast('Profile updated successfully!');
      setShowSettings(false);
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

  // Admin: reinstate a defaulted loan back to active so payments can be collected again
  const handleReinstateLoan = async () => {
    if (!selectedLoanId) return;
    if (!window.confirm('Reinstate this loan to active? Payments can be collected on it again.')) return;
    setLoading(true);
    setError('');
    try {
      await api.post(`/loans/${selectedLoanId}/reinstate`, {});
      showToast('Loan reinstated to active.');
      viewStatement(selectedLoanId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Admin: write off a loan's remaining balance as unrecoverable bad debt
  const handleWriteOffLoan = async () => {
    if (!selectedLoanId) return;
    const reason = window.prompt('Reason for writing off this loan as bad debt:');
    if (reason === null) return; // cancelled
    if (!reason.trim()) {
      setError('A reason is required to write off a loan.');
      return;
    }
    if (!window.confirm('This permanently zeroes the loan\'s outstanding balance and posts it to the ledger as bad debt. Continue?')) return;
    setLoading(true);
    setError('');
    try {
      await api.post(`/loans/${selectedLoanId}/write-off`, { reason });
      showToast('Loan written off as bad debt.');
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

  // Quick daily collection mark — mirrors the physical passbook's per-day
  // paid/not-paid checkbox. 'paid'/'partial' actually records a real
  // interest payment (asks for the amount); 'not_paid' is just a log entry.
  const handleMarkDailyCollection = async (loanId, status, date = null) => {
    let amount = null;
    if (status === 'paid' || status === 'partial') {
      const input = window.prompt(`Enter the amount collected (${status === 'partial' ? 'partial payment' : 'full payment'}):`);
      if (input === null) return; // cancelled
      amount = parseFloat(input);
      if (isNaN(amount) || amount <= 0) {
        setError('Please enter a valid positive amount.');
        return;
      }
    }
    setLoading(true);
    setError('');
    try {
      await api.post(`/loans/${loanId}/daily-collection`, { date, status, amount });
      showToast(status === 'not_paid' ? 'Marked as not paid today.' : `Marked as ${status} — LKR ${amount.toLocaleString()} recorded.`);
      fetchDashboardData();
      if (loanStatement?.loan?.id === loanId) viewStatement(loanId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Admin-only quick action: record a principal payment directly against a
  // loan (e.g. self-collected loans with no assigned agent). Interest
  // payments already have a dedicated flow via the Daily Collection Tracker
  // above; this covers the one gap that's left now that borrowers no longer
  // have self-service login to submit their own principal payments.
  const handleRecordPrincipalPayment = async (loanId) => {
    const input = window.prompt('Enter the principal amount received from the borrower (LKR):');
    if (input === null) return; // cancelled
    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/payments', {
        loan_id: loanId,
        amount,
        payment_type: 'principal',
        payment_method: 'cash',
        idempotency_key: 'idemp_principal_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now()
      });
      showToast(`Principal payment of LKR ${amount.toLocaleString()} recorded.`);
      if (loanStatement?.loan?.id === loanId) viewStatement(loanId);
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

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/auth/login', { phone: loginPhone, password: loginPassword });
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

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setForgotMessage('');
    try {
      const data = await api.post('/auth/forgot-password', { identifier: forgotIdentifier });
      setForgotMessage(data.message);
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

  const isValidNIC = (nic) => {
    if (!nic) return false;
    const cleaned = nic.trim().toUpperCase();
    return /^[0-9]{9}[VX]$/.test(cleaned) || /^[0-9]{12}$/.test(cleaned);
  };

  const validateStep1 = () => {
    if (!newLoan.borrower_name || !newLoan.borrower_name.trim()) return false;
    if (!newLoan.borrower_phone || !newLoan.borrower_phone.trim()) return false;
    if (!newLoan.borrower_address || !newLoan.borrower_address.trim()) return false;
    if (!newLoan.nic_number || !isValidNIC(newLoan.nic_number)) return false;
    if (!newLoan.principal_amount || parseFloat(newLoan.principal_amount) <= 0) return false;
    if (!newLoan.interest_rate || parseFloat(newLoan.interest_rate) < 0) return false;
    if (!borrowerProfileForm.loan_purpose || !borrowerProfileForm.loan_purpose.trim()) return false;
    if (borrowerProfileForm.dependents_count === undefined || borrowerProfileForm.dependents_count === '') return false;
    if (borrowerProfileForm.monthly_income === undefined || borrowerProfileForm.monthly_income === '') return false;
    return true;
  };

  const runStep1Validation = () => {
    const errors = {};
    let firstErrorField = null;

    if (!newLoan.borrower_name || !newLoan.borrower_name.trim()) {
      errors.borrower_name = "Borrower name is required.";
      if (!firstErrorField) firstErrorField = "borrower_name";
    }
    if (!newLoan.borrower_phone || !newLoan.borrower_phone.trim()) {
      errors.borrower_phone = "Borrower phone number is required.";
      if (!firstErrorField) firstErrorField = "borrower_phone";
    }
    if (!newLoan.borrower_address || !newLoan.borrower_address.trim()) {
      errors.borrower_address = "Borrower address is required.";
      if (!firstErrorField) firstErrorField = "borrower_address";
    }
    if (!newLoan.nic_number || !isValidNIC(newLoan.nic_number)) {
      errors.nic_number = "A valid Sri Lankan NIC number is required.";
      if (!firstErrorField) firstErrorField = "nic_number";
    }
    if (!newLoan.principal_amount || parseFloat(newLoan.principal_amount) <= 0) {
      errors.principal_amount = "Principal amount must be a positive number.";
      if (!firstErrorField) firstErrorField = "principal_amount";
    }
    if (!newLoan.interest_rate || parseFloat(newLoan.interest_rate) < 0) {
      errors.interest_rate = "Interest rate must be a non-negative number.";
      if (!firstErrorField) firstErrorField = "interest_rate";
    }
    if (!borrowerProfileForm.loan_purpose || !borrowerProfileForm.loan_purpose.trim()) {
      errors.loan_purpose = "Purpose of loan is required.";
      if (!firstErrorField) firstErrorField = "loan_purpose";
    }
    if (borrowerProfileForm.dependents_count === undefined || borrowerProfileForm.dependents_count === '' || borrowerProfileForm.dependents_count === null) {
      errors.dependents_count = "Number of dependents is required.";
      if (!firstErrorField) firstErrorField = "dependents_count";
    }
    if (borrowerProfileForm.monthly_income === undefined || borrowerProfileForm.monthly_income === '' || borrowerProfileForm.monthly_income === null) {
      errors.monthly_income = "Monthly income is required.";
      if (!firstErrorField) firstErrorField = "monthly_income";
    }

    setValidationErrors(errors);

    if (firstErrorField) {
      setTimeout(() => {
        const element = document.getElementById(firstErrorField);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus();
        }
      }, 50);
      return false;
    }
    return true;
  };

  const runStep2Validation = () => {
    const errors = {};
    let firstErrorField = null;

    if (!guarantorForm.full_name || !guarantorForm.full_name.trim()) {
      errors.guarantor_full_name = "Guarantor full name is required.";
      if (!firstErrorField) firstErrorField = "guarantor_full_name";
    }
    if (!guarantorForm.nic_number || !isValidNIC(guarantorForm.nic_number)) {
      errors.guarantor_nic_number = "A valid Sri Lankan NIC number is required for the guarantor.";
      if (!firstErrorField) firstErrorField = "guarantor_nic_number";
    }
    if (!guarantorForm.phone || !guarantorForm.phone.trim()) {
      errors.guarantor_phone = "Guarantor phone number is required.";
      if (!firstErrorField) firstErrorField = "guarantor_phone";
    }
    if (!guarantorForm.address || !guarantorForm.address.trim()) {
      errors.guarantor_address = "Guarantor address is required.";
      if (!firstErrorField) firstErrorField = "guarantor_address";
    }

    setValidationErrors(errors);

    if (firstErrorField) {
      setTimeout(() => {
        const element = document.getElementById(firstErrorField);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus();
        }
      }, 50);
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    setError('');
    if (runStep1Validation()) {
      setGiveLoanStep(2);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (includeGuarantor && giveLoanStep === 1) {
      handleNextStep();
    } else {
      handleCreateLoan(e);
    }
  };

  // Admin: Create new loan
  const handleCreateLoan = async (e) => {
    if (e) e.preventDefault();
    setError('');
    
    if (!runStep1Validation()) {
      setGiveLoanStep(1);
      return;
    }
    if (includeGuarantor && !runStep2Validation()) {
      setGiveLoanStep(2);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = {
        ...newLoan,
        guarantor: includeGuarantor ? guarantorForm : null,
        borrower_profile: borrowerProfileForm
      };
      await api.post('/loans', payload);
      showToast(`Loan disbursed to ${newLoan.borrower_name} successfully! Notification sent.`);
      setNewLoan({
        borrower_name: '',
        borrower_phone: '',
        borrower_address: '',
        borrower_email: '',
        borrower_gender: '',
        principal_amount: '',
        interest_rate: '2.00',
        interest_type: 'daily',
        assigned_agent_id: '',
        nic_number: '',
        nic_photo: '',
        collection_mode: 'open_ended',
        duration_periods: ''
      });
      setGiveLoanStep(1);
      setIncludeGuarantor(false);
      setGuarantorForm(emptyGuarantor);
      setBorrowerProfileForm(emptyBorrowerProfile);
      setValidationErrors({});
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

  const handleLedgerCollectPayment = async (e) => {
    e.preventDefault();
    if (!loanStatement || !loanStatement.loan) return;
    const loanId = loanStatement.loan.id;
    if (!ledgerPaymentForm.amount || parseFloat(ledgerPaymentForm.amount) <= 0) {
      showToast('Please enter a valid amount.', 'error');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post('/payments', {
        loan_id: loanId,
        payment_type: ledgerPaymentForm.payment_type,
        amount: parseFloat(ledgerPaymentForm.amount),
        notes: ledgerPaymentForm.notes,
        proof_image_url: ledgerPaymentForm.proof_image || null,
        payment_method: ledgerPaymentForm.payment_method,
        idempotency_key: ledgerPaymentForm.idempotency_key || (Math.random().toString(36).substring(2) + Date.now())
      });

      const kind = ledgerPaymentForm.payment_type === 'interest' ? 'Interest' : 'Principal';
      showToast(`${kind} collection recorded successfully! LKR ${parseFloat(ledgerPaymentForm.amount).toLocaleString()} collected.`);

      setLedgerPaymentForm({
        payment_type: 'interest',
        amount: '',
        notes: '',
        proof_image: '',
        payment_method: 'cash',
        idempotency_key: Math.random().toString(36).substring(2) + Date.now()
      });

      const updatedDetails = await api.get(`/loans/${loanId}`);
      setLoanStatement(updatedDetails);
      fetchDashboardData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBorrowerPayment = async (e) => {
    e.preventDefault();
    if (!borrowerPayment.loan_id) {
      setError('Please select a loan.');
      return;
    }
    if (!borrowerPayment.amount || parseFloat(borrowerPayment.amount) <= 0) {
      setError('Please enter a valid amount.');
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
        proof_image_url: borrowerPayment.proof_image || null,
        payment_method: borrowerPayment.payment_method,
        idempotency_key: borrowerPayment.idempotency_key
      });

      const loan = borrowerData.loans.find(l => l.id === borrowerPayment.loan_id);
      const kind = borrowerPayment.payment_type === 'interest' ? 'Interest' : 'Principal';
      showToast(`Digital ${kind} payment of LKR ${parseFloat(borrowerPayment.amount).toLocaleString()} submitted successfully!`);

      fetchDashboardData();

      if (response.transaction) {
        handleOpenReceipt(response.transaction);
      } else {
        handleOpenReceipt({
          id: response.transactionId || 'N/A',
          payment_date: new Date().toISOString(),
          payment_type: borrowerPayment.payment_type,
          borrower_name: user.name,
          borrower_phone: user.phone,
          agent_name: loan?.agent_name || 'Lender Office',
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
    setLedgerTab('passbook');
    setLedgerPaymentForm({
      payment_type: 'interest',
      amount: '',
      notes: '',
      proof_image: '',
      payment_method: 'cash',
      idempotency_key: Math.random().toString(36).substring(2) + Date.now()
    });
    setShowGuarantorEditor(false);
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

  // Admin: add or edit the guarantor on an already-created loan.
  const handleOpenGuarantorEditor = (existingGuarantor) => {
    setGuarantorEditForm(existingGuarantor ? {
      full_name: existingGuarantor.full_name || '',
      nic_number: existingGuarantor.nic_number || '',
      gender: existingGuarantor.gender || '',
      ethnicity: existingGuarantor.ethnicity || '',
      address: existingGuarantor.address || '',
      phone: existingGuarantor.phone || '',
      protected_under_debt_act: !!existingGuarantor.protected_under_debt_act,
      monthly_income_business: existingGuarantor.monthly_income_business || '',
      monthly_income_agriculture: existingGuarantor.monthly_income_agriculture || '',
      monthly_income_other: existingGuarantor.monthly_income_other || '',
      monthly_expense_food: existingGuarantor.monthly_expense_food || '',
      monthly_expense_rent: existingGuarantor.monthly_expense_rent || '',
      monthly_expense_other: existingGuarantor.monthly_expense_other || ''
    } : emptyGuarantor);
    setShowGuarantorEditor(true);
  };

  const handleSaveGuarantor = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.put(`/loans/${loanStatement.loan.id}/guarantor`, guarantorEditForm);
      showToast('Guarantor saved.');
      setShowGuarantorEditor(false);
      viewStatement(loanStatement.loan.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveGuarantor = async () => {
    if (!window.confirm('Remove the guarantor from this loan?')) return;
    setLoading(true);
    setError('');
    try {
      await api.delete(`/loans/${loanStatement.loan.id}/guarantor`);
      showToast('Guarantor removed.');
      viewStatement(loanStatement.loan.id);
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

  // Quick fill credential helper
  const fillCredentials = (phone, password) => {
    setLoginPhone(phone);
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
              <div className="receipt-header-icon"><Banknote /></div>
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
                <Printer className="icon" /> Print
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

      {/* Loan Agreement Modal (Screen View) */}
      {showLoanAgreement && loanStatement && (
        <div className="agreement-modal-overlay receipt-modal-overlay" onClick={() => setShowLoanAgreement(false)}>
          <div className="receipt-modal-card" style={{ maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="receipt-header">
              <div className="receipt-header-icon"><FileText /></div>
              <div className="receipt-title">Loan Agreement</div>
              <div className="receipt-subtitle">Reference: {loanStatement.loan.id}</div>
            </div>

            <p style={{ fontSize: '14px', lineHeight: 1.6 }}>
              This agreement is entered into on <strong>{new Date(loanStatement.loan.created_at).toLocaleDateString()}</strong> between the
              Lender and <strong>{loanStatement.loan.borrower_name}</strong> (NIC: {loanStatement.loan.nic_number || 'N/A'}, Address: {loanStatement.loan.borrower_address || 'N/A'}), the Borrower.
            </p>

            <h4 style={{ fontSize: '15px', margin: '16px 0 6px' }}>1. Loan Amount</h4>
            <p style={{ fontSize: '14px' }}>The Lender agrees to give the Borrower a loan of <strong>LKR {parseFloat(loanStatement.loan.principal_amount).toLocaleString()}</strong>.</p>

            <h4 style={{ fontSize: '15px', margin: '16px 0 6px' }}>2. Interest & Repayment</h4>
            <p style={{ fontSize: '14px' }}>
              Interest is charged at <strong>{loanStatement.loan.interest_rate}%</strong> of the principal, payable every <strong>{loanStatement.loan.interest_type === 'daily' ? 'day' : loanStatement.loan.interest_type === 'weekly' ? 'week' : 'month'}</strong>.
              The principal amount remains payable in full (or in part, at the Borrower's discretion) at any time; the loan is considered
              settled once the full principal of LKR {parseFloat(loanStatement.loan.principal_amount).toLocaleString()} has been repaid, regardless of the
              interest payment schedule.
            </p>

            {loanStatement.loan.loan_purpose && (
              <>
                <h4 style={{ fontSize: '15px', margin: '16px 0 6px' }}>3. Purpose of Loan</h4>
                <p style={{ fontSize: '14px' }}>{loanStatement.loan.loan_purpose}</p>
              </>
            )}

            {loanStatement.guarantor && (
              <>
                <h4 style={{ fontSize: '15px', margin: '16px 0 6px' }}>4. Guarantor</h4>
                <p style={{ fontSize: '14px' }}>
                  <strong>{loanStatement.guarantor.full_name}</strong> (NIC: {loanStatement.guarantor.nic_number}), residing at {loanStatement.guarantor.address},
                  stands as guarantor for this loan and accepts joint responsibility for repayment in the event the Borrower defaults.
                </p>
              </>
            )}

            <h4 style={{ fontSize: '15px', margin: '16px 0 6px' }}>{loanStatement.guarantor ? '5' : loanStatement.loan.loan_purpose ? '4' : '3'}. Default</h4>
            <p style={{ fontSize: '14px' }}>If the Borrower fails to pay interest or repay the principal as agreed, the Lender has the right to take legal action to recover the outstanding amount.</p>

            <h4 style={{ fontSize: '15px', margin: '16px 0 6px' }}>{loanStatement.guarantor ? '6' : loanStatement.loan.loan_purpose ? '5' : '4'}. Declaration</h4>
            <p style={{ fontSize: '14px' }}>Both parties confirm they have read, understood, and agree to all the terms stated above.</p>

            <div className="receipt-actions">
              <button type="button" className="glass-btn glass-btn-secondary" onClick={() => setShowLoanAgreement(false)}>
                Close
              </button>
              <button type="button" className="glass-btn glass-btn-emerald" onClick={() => window.print()}>
                <Printer className="icon" /> Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Container (Loan Agreement Print View) */}
      {showLoanAgreement && loanStatement && (
        <div className="agreement-print-only">
          <h1>Loan Agreement</h1>
          <p style={{ textAlign: 'center', fontSize: '9pt', color: '#444' }}>Reference: {loanStatement.loan.id}</p>

          <p>
            This agreement is entered into on <strong>{new Date(loanStatement.loan.created_at).toLocaleDateString()}</strong> between the
            Lender and <strong>{loanStatement.loan.borrower_name}</strong> (NIC: {loanStatement.loan.nic_number || 'N/A'}, Address: {loanStatement.loan.borrower_address || 'N/A'}), the Borrower.
          </p>

          <h2>1. Loan Amount</h2>
          <p>The Lender agrees to give the Borrower a loan of <strong>LKR {parseFloat(loanStatement.loan.principal_amount).toLocaleString()}</strong>.</p>

          <h2>2. Interest & Repayment</h2>
          <p>
            Interest is charged at <strong>{loanStatement.loan.interest_rate}%</strong> of the principal, payable every{' '}
            <strong>{loanStatement.loan.interest_type === 'daily' ? 'day' : loanStatement.loan.interest_type === 'weekly' ? 'week' : 'month'}</strong>.
            The principal amount remains payable in full (or in part, at the Borrower's discretion) at any time; the loan is considered
            settled once the full principal of LKR {parseFloat(loanStatement.loan.principal_amount).toLocaleString()} has been repaid, regardless of the
            interest payment schedule.
          </p>

          {loanStatement.loan.loan_purpose && (
            <>
              <h2>3. Purpose of Loan</h2>
              <p>{loanStatement.loan.loan_purpose}</p>
            </>
          )}

          {loanStatement.guarantor && (
            <>
              <h2>{loanStatement.loan.loan_purpose ? '4' : '3'}. Guarantor</h2>
              <p>
                <strong>{loanStatement.guarantor.full_name}</strong> (NIC: {loanStatement.guarantor.nic_number}), residing at {loanStatement.guarantor.address},
                stands as guarantor for this loan and accepts joint responsibility for repayment in the event the Borrower defaults.
              </p>
            </>
          )}

          <h2>{loanStatement.guarantor ? '5' : loanStatement.loan.loan_purpose ? '4' : '3'}. Default</h2>
          <p>If the Borrower fails to pay interest or repay the principal as agreed, the Lender has the right to take legal action to recover the outstanding amount.</p>

          <h2>{loanStatement.guarantor ? '6' : loanStatement.loan.loan_purpose ? '5' : '4'}. Declaration</h2>
          <p>Both parties confirm they have read, understood, and agree to all the terms stated above.</p>

          <div className="agreement-signature-block">
            <div className="agreement-signature-line">Lender</div>
            <div className="agreement-signature-line">Borrower ({loanStatement.loan.borrower_name})</div>
            {loanStatement.guarantor && (
              <div className="agreement-signature-line">Guarantor ({loanStatement.guarantor.full_name})</div>
            )}
          </div>
          <div className="agreement-signature-block">
            <div className="agreement-signature-line">Witness 1</div>
            <div className="agreement-signature-line">Witness 2</div>
          </div>
        </div>
      )}

      {/* Toast Alert overlay */}
      <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '380px' }}>
        {toastAlerts.map(toast => (
          <div key={toast.id} className="animate-fade-in" style={{ padding: '16px', background: 'var(--accent-emerald)', border: 'none', color: '#ffffff', borderRadius: '8px', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span><Bell className="icon" /> SMS Notification sent</span>
            </div>
            <p style={{ fontSize: '13px', lineHeight: '1.4' }}>{toast.message}</p>
          </div>
        ))}
      </div>

      {/* Header bar - Simple Solid White Bar */}
      {token && user && (
        <header className="app-header animate-fade-in">
          <div className="app-header-info">
            <h1 style={{ fontSize: '24px' }}>
              <span className="app-brand-mark"><Banknote className="icon" /></span> STN MICRO CREDIT
            </h1>
            <span className="badge badge-active">{user.role}</span>
          </div>

          {/* Desktop Navigation Links */}
          {user.role === 'admin' && (
            <div className="desktop-header-nav">
              <button className={`nav-link-btn ${view === 'dashboard' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setSelectedLoanId(null); setLoanStatement(null); }}><Home className="icon" /> Home</button>
              <button className={`nav-link-btn ${view === 'create-loan' ? 'active' : ''}`} onClick={() => { setView('create-loan'); setSelectedLoanId(null); setLoanStatement(null); }}><Banknote className="icon" /> Give Loan</button>
              <button className={`nav-link-btn ${view === 'loans' ? 'active' : ''}`} onClick={() => { setView('loans'); setSelectedLoanId(null); setLoanStatement(null); }}><ClipboardList className="icon" /> Check Loans</button>
              <button className={`nav-link-btn ${view === 'agents' ? 'active' : ''}`} onClick={() => { setView('agents'); setSelectedLoanId(null); setLoanStatement(null); }}><Users className="icon" /> Agent Route</button>
              <button className={`nav-link-btn ${view === 'admin-tools' ? 'active' : ''}`} onClick={openAdminTools}><Landmark className="icon" /> Users & Cash Tools</button>
              <button className={`nav-link-btn ${view === 'payment-history' ? 'active' : ''}`} onClick={() => { setView('payment-history'); setSelectedLoanId(null); setLoanStatement(null); }}><Receipt className="icon" /> Payment History</button>
              <button className={`nav-link-btn ${view === 'audit-log' ? 'active' : ''}`} onClick={() => { setView('audit-log'); setSelectedLoanId(null); setLoanStatement(null); }}><ScrollText className="icon" /> Audit Log</button>
            </div>
          )}
          {user.role === 'agent' && (
            <div className="desktop-header-nav">
              <button className={`nav-link-btn ${agentSubView === 'collect' ? 'active' : ''}`} onClick={() => setAgentSubView('collect')}><Banknote className="icon" /> Collect Payments</button>
              <button className={`nav-link-btn ${agentSubView === 'history' ? 'active' : ''}`} onClick={() => setAgentSubView('history')}><ScrollText className="icon" /> Collection History</button>
              <button className={`nav-link-btn ${agentSubView === 'remit' ? 'active' : ''}`} onClick={() => setAgentSubView('remit')}><Landmark className="icon" /> Remit Cash</button>
            </div>
          )}
          {user.role === 'borrower' && (
            <div className="desktop-header-nav">
              <button className={`nav-link-btn ${view === 'dashboard' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setSelectedLoanId(null); setLoanStatement(null); }}><Home className="icon" /> Home</button>
            </div>
          )}

          <div className="app-header-nav">
            <span style={{ color: 'var(--text-secondary)', fontSize: '16px' }} className="desktop-only">
              User: <strong style={{ color: 'var(--text-primary)' }}>{user.name}</strong>
            </span>
            <button className="glass-btn glass-btn-secondary" style={{ padding: '10px 16px', fontSize: '14px' }} onClick={handleOpenSettings}>
              <Settings className="icon" /> <span className="btn-label-text">Settings</span>
            </button>
            <button className="glass-btn glass-btn-rose" style={{ padding: '10px 20px', fontSize: '15px' }} onClick={handleLogout}>
              <LogOut className="icon" /> <span className="btn-label-text">Logout</span>
            </button>
          </div>
        </header>
      )}

      {/* Change Password Modal (all roles) */}
      {showChangePassword && (
        <div className="receipt-modal-overlay" onClick={() => setShowChangePassword(false)}>
          <div className="glass-card" style={{ maxWidth: '420px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '20px', marginBottom: '16px' }}><KeyRound className="icon" /> Change Password</h3>
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

      {/* Settings Modal (Profile & Security) */}
      {showSettings && (
        <div className="receipt-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Settings className="icon" style={{ color: 'var(--accent-blue)', width: '24px', height: '24px' }} />
              <h3 style={{ fontSize: '22px', margin: 0 }}>Account Settings</h3>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', gap: '16px', marginBottom: '20px' }}>
              <button type="button"
                style={{
                  padding: '8px 4px',
                  background: 'none',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: settingsTab === 'profile' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  borderBottom: settingsTab === 'profile' ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  cursor: 'pointer'
                }}
                onClick={() => setSettingsTab('profile')}>
                Edit Profile
              </button>
              <button type="button"
                style={{
                  padding: '8px 4px',
                  background: 'none',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: settingsTab === 'security' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  borderBottom: settingsTab === 'security' ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  cursor: 'pointer'
                }}
                onClick={() => setSettingsTab('security')}>
                Security & Password
              </button>
            </div>

            {/* Tab 1: Profile Settings */}
            {settingsTab === 'profile' && (
              <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>FULL NAME *</label>
                  <input type="text" required className="glass-input" style={{ width: '100%' }}
                    value={profileForm.name}
                    onChange={e => setProfileForm(prev => ({ ...prev, name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>PHONE NUMBER *</label>
                  <input type="tel" required className="glass-input" style={{ width: '100%' }}
                    value={profileForm.phone}
                    onChange={e => setProfileForm(prev => ({ ...prev, phone: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>EMAIL ADDRESS</label>
                  <input type="email" className="glass-input" style={{ width: '100%' }}
                    value={profileForm.email}
                    onChange={e => setProfileForm(prev => ({ ...prev, email: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>GENDER</label>
                  <select className="glass-input" style={{ width: '100%', textTransform: 'capitalize' }}
                    value={profileForm.gender}
                    onChange={e => setProfileForm(prev => ({ ...prev, gender: e.target.value }))}>
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button type="button" className="glass-btn glass-btn-secondary" style={{ flex: 1 }} onClick={() => setShowSettings(false)}>Cancel</button>
                  <button type="submit" className="glass-btn glass-btn-emerald" style={{ flex: 1 }} disabled={loading}>Save Profile</button>
                </div>
              </form>
            )}

            {/* Tab 2: Security Settings */}
            {settingsTab === 'security' && (
              <form onSubmit={async (e) => {
                e.preventDefault();
                await handleChangePassword(e);
                setShowSettings(false);
              }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>CURRENT PASSWORD</label>
                  <input type="password" required className="glass-input" style={{ width: '100%' }}
                    value={passwordForm.current_password}
                    onChange={e => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>NEW PASSWORD</label>
                  <input type="password" required minLength={6} className="glass-input" style={{ width: '100%' }}
                    value={passwordForm.new_password}
                    onChange={e => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>CONFIRM NEW PASSWORD</label>
                  <input type="password" required minLength={6} className="glass-input" style={{ width: '100%' }}
                    value={passwordForm.confirm_password}
                    onChange={e => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))} />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button type="button" className="glass-btn glass-btn-secondary" style={{ flex: 1 }} onClick={() => setShowSettings(false)}>Cancel</button>
                  <button type="submit" className="glass-btn glass-btn-emerald" style={{ flex: 1 }} disabled={loading}>Update Password</button>
                </div>
              </form>
            )}
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
              <h2 style={{ fontSize: '28px', textAlign: 'center', marginBottom: '8px' }}>STN MICRO CREDIT</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', marginBottom: '24px' }}>Easy loan tracking and collections</p>

              {!showForgotPassword ? (
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>PHONE NUMBER</label>
                    <input type="tel" required className="glass-input" placeholder="e.g. 0771234567" value={loginPhone} onChange={e => setLoginPhone(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>PASSWORD</label>
                    <input type="password" required className="glass-input" placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                  </div>
                  <button type="submit" className="glass-btn" disabled={loading} style={{ width: '100%', marginTop: '8px' }}>
                    {loading ? 'Loading...' : 'Login'}
                  </button>
                  <button type="button" className="glass-btn glass-btn-secondary" style={{ width: '100%', fontSize: '13px' }} onClick={() => { setShowForgotPassword(true); setError(''); setForgotMessage(''); }}>
                    Forgot password?
                  </button>
                </form>
              ) : (
                <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Enter your registered phone number. A temporary password will be sent via SMS.
                  </p>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>PHONE NUMBER</label>
                    <input type="tel" required className="glass-input" placeholder="e.g. 0771234567" value={forgotIdentifier} onChange={e => setForgotIdentifier(e.target.value)} />
                  </div>
                  {forgotMessage && (
                    <p style={{ fontSize: '13px', color: 'var(--accent-emerald)', margin: 0 }}>{forgotMessage}</p>
                  )}
                  <button type="submit" className="glass-btn" disabled={loading} style={{ width: '100%' }}>
                    {loading ? 'Sending...' : 'Send Temporary Password'}
                  </button>
                  <button type="button" className="glass-btn glass-btn-secondary" style={{ width: '100%', fontSize: '13px' }} onClick={() => { setShowForgotPassword(false); setError(''); setForgotMessage(''); setForgotIdentifier(''); }}>
                    <ArrowLeft className="icon" /> Back to Login
                  </button>
                </form>
              )}

              <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '12px', fontWeight: 'bold' }}>DEMO QUICK-FILL CREDENTIALS</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 4px', fontSize: '11px' }} onClick={() => fillCredentials('0774048194', 'password123')}>Admin</button>
                  <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 4px', fontSize: '11px' }} onClick={() => fillCredentials('+94777654321', 'password123')}>Agent</button>
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
                    <span className="menu-card-icon"><Banknote /></span>
                    <div>
                      <h3 style={{ fontSize: '26px', marginBottom: '10px', fontWeight: '800', color: 'var(--accent-emerald)' }}>Give New Loan</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: '1.5' }}>Type borrower name and phone number to disburse cash instantly</p>
                    </div>
                  </div>

                  <div className="menu-card menu-card-check" onClick={() => setView('loans')}>
                    <span className="menu-card-icon"><ClipboardList /></span>
                    <div>
                      <h3 style={{ fontSize: '26px', marginBottom: '10px', fontWeight: '800', color: 'var(--accent-blue)' }}>Check Loans & Payments</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: '1.5' }}>Search and view customer accounts, balances, and ledger sheets</p>
                    </div>
                  </div>

                  <div className="menu-card menu-card-agent" onClick={() => setView('agents')}>
                    <span className="menu-card-icon"><Users /></span>
                    <div>
                      <h3 style={{ fontSize: '26px', marginBottom: '10px', fontWeight: '800', color: '#7c3aed' }}>Agent Route Progress</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: '1.5' }}>Check cash collections collected by your agents today</p>
                    </div>
                  </div>

                </div>

                {/* Interest Accrual & Formula Dashboard */}
                <div className="glass-card" style={{ marginTop: '16px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp className="icon" /> Interest Accrual & Calculations Center
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
                      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}><BarChart3 className="icon" /> Interest Posting Formulas</h3>
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

            {view === 'create-loan' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button className="glass-btn glass-btn-secondary" style={{ fontSize: '15px', fontWeight: 'bold' }} onClick={() => {
                    setView('dashboard');
                    setGiveLoanStep(1);
                  }}>
                    <ArrowLeft className="icon" /> Back to Main Menu
                  </button>
                </div>

                <div className="glass-card" style={{ maxWidth: '900px', margin: '0 auto', width: '100%', padding: '0', overflow: 'hidden' }}>
                  <div className="wizard-layout">
                    {/* Stepper Navigation Sidebar */}
                    <div className="wizard-sidebar">
                      <h4 className="wizard-title" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', margin: '0 0 10px', fontWeight: 'bold' }}>LOAN WIZARD</h4>
                      
                      <button 
                        type="button"
                        className={`step-indicator ${giveLoanStep === 1 ? 'active' : 'completed'}`}
                        onClick={() => setGiveLoanStep(1)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                      >
                        <div className="step-number">1</div>
                        <div>
                          <div className="step-label">Borrower & Loan</div>
                          <span className="step-subtext">KYC, Profile & Terms</span>
                        </div>
                      </button>

                      <button 
                        type="button"
                        className={`step-indicator ${giveLoanStep === 2 ? 'active' : includeGuarantor ? '' : 'disabled'}`}
                        disabled={!includeGuarantor}
                        onClick={() => {
                          if (includeGuarantor && validateStep1()) {
                            setGiveLoanStep(2);
                          }
                        }}
                        style={{ border: 'none', background: 'none', cursor: includeGuarantor ? 'pointer' : 'not-allowed' }}
                      >
                        <div className="step-number">2</div>
                        <div>
                          <div className="step-label">Guarantor Details</div>
                          <span className="step-subtext">{includeGuarantor ? 'Required step' : 'Optional (Skipped)'}</span>
                        </div>
                      </button>
                    </div>

                    {/* Wizard Body / Form Content */}
                    <div className="wizard-body">
                      <h3 style={{ fontSize: '28px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Banknote className="icon" style={{ color: 'var(--accent-blue)', fontSize: '24px' }} /> Give New Loan
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                        {giveLoanStep === 1 
                          ? "Step 1 of 2: Borrower profile, KYC information, and loan interest terms."
                          : "Step 2 of 2: Enter details for the guarantor backing this loan."
                        }
                      </p>

                      <form noValidate onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {giveLoanStep === 1 && (
                          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* --- SECTION 1: BORROWER DETAILS --- */}
                            <div style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', margin: '0', fontSize: '15px' }}>
                                <User className="icon" /> 1. BORROWER PERSONAL DETAILS
                              </p>
                              
                              <div>
                                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>BORROWER NAME *</label>
                                <input id="borrower_name" type="text" className="glass-input" style={{ borderColor: validationErrors.borrower_name ? 'var(--accent-rose)' : '', borderWidth: validationErrors.borrower_name ? '2px' : '' }} placeholder="e.g. Bandara Perera" value={newLoan.borrower_name} onChange={e => { setNewLoan(prev => ({ ...prev, borrower_name: e.target.value })); clearFieldError('borrower_name'); }} />
                                {validationErrors.borrower_name && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors.borrower_name}</span>}
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>BORROWER MOBILE NUMBER (SRI LANKA) *</label>
                                <input id="borrower_phone" type="tel" className="glass-input" style={{ borderColor: validationErrors.borrower_phone ? 'var(--accent-rose)' : '', borderWidth: validationErrors.borrower_phone ? '2px' : '' }} placeholder="e.g. 0771234567 or +94771234567" value={newLoan.borrower_phone} onChange={e => { setNewLoan(prev => ({ ...prev, borrower_phone: e.target.value })); clearFieldError('borrower_phone'); }} />
                                {validationErrors.borrower_phone && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors.borrower_phone}</span>}
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>BORROWER ADDRESS *</label>
                                <input id="borrower_address" type="text" className="glass-input" style={{ borderColor: validationErrors.borrower_address ? 'var(--accent-rose)' : '', borderWidth: validationErrors.borrower_address ? '2px' : '' }} placeholder="e.g. No. 12, Temple Road, Kandy" value={newLoan.borrower_address} onChange={e => { setNewLoan(prev => ({ ...prev, borrower_address: e.target.value })); clearFieldError('borrower_address'); }} />
                                {validationErrors.borrower_address && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors.borrower_address}</span>}
                              </div>

                              <div className="form-grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>BORROWER EMAIL (OPTIONAL)</label>
                                  <input type="email" className="glass-input" placeholder="e.g. name@example.com" value={newLoan.borrower_email || ''} onChange={e => setNewLoan(prev => ({ ...prev, borrower_email: e.target.value }))} />
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>GENDER</label>
                                  <select className="glass-input" value={newLoan.borrower_gender || ''} onChange={e => setNewLoan(prev => ({ ...prev, borrower_gender: e.target.value }))}>
                                    <option value="">Select Gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                  </select>
                                </div>
                              </div>

                              <div className="form-grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>NIC NUMBER *</label>
                                  <input id="nic_number" type="text" className="glass-input" style={{ borderColor: validationErrors.nic_number ? 'var(--accent-rose)' : '', borderWidth: validationErrors.nic_number ? '2px' : '' }} placeholder="e.g. 199012345678 or 123456789V" value={newLoan.nic_number} onChange={e => { setNewLoan(prev => ({ ...prev, nic_number: e.target.value })); clearFieldError('nic_number'); }} />
                                  {validationErrors.nic_number && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors.nic_number}</span>}
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>NIC PHOTO</label>
                                  <input type="file" accept="image/*" className="glass-input" onChange={handleNICPhotoChange} />
                                  {newLoan.nic_photo && (
                                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                      <img src={newLoan.nic_photo} alt="NIC preview" style={{ width: '45px', height: '30px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-glass)' }} />
                                      <span style={{ fontSize: '11px', color: 'var(--accent-emerald)' }}><CircleCheck className="icon" /> Photo Attached</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* --- SECTION 2: BORROWER PROFILE DETAILS --- */}
                            <div style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', margin: '0', fontSize: '15px' }}>
                                <ClipboardList className="icon" /> 2. BORROWER PROFILE DETAILS
                              </p>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Purpose of Loan *</label>
                                  <input id="loan_purpose" type="text" className="glass-input" style={{ borderColor: validationErrors.loan_purpose ? 'var(--accent-rose)' : '', borderWidth: validationErrors.loan_purpose ? '2px' : '' }} placeholder="e.g. Business working capital, home repair" value={borrowerProfileForm.loan_purpose} onChange={e => { setBorrowerProfileForm(prev => ({ ...prev, loan_purpose: e.target.value })); clearFieldError('loan_purpose'); }} />
                                  {validationErrors.loan_purpose && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors.loan_purpose}</span>}
                                </div>

                                <div className="form-grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Number of Dependents *</label>
                                    <input id="dependents_count" type="number" min="0" className="glass-input" style={{ borderColor: validationErrors.dependents_count ? 'var(--accent-rose)' : '', borderWidth: validationErrors.dependents_count ? '2px' : '' }} value={borrowerProfileForm.dependents_count} onChange={e => { setBorrowerProfileForm(prev => ({ ...prev, dependents_count: e.target.value })); clearFieldError('dependents_count'); }} />
                                    {validationErrors.dependents_count && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors.dependents_count}</span>}
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Monthly Income (LKR) *</label>
                                    <input id="monthly_income" type="number" min="0" className="glass-input" style={{ borderColor: validationErrors.monthly_income ? 'var(--accent-rose)' : '', borderWidth: validationErrors.monthly_income ? '2px' : '' }} value={borrowerProfileForm.monthly_income} onChange={e => { setBorrowerProfileForm(prev => ({ ...prev, monthly_income: e.target.value })); clearFieldError('monthly_income'); }} />
                                    {validationErrors.monthly_income && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors.monthly_income}</span>}
                                  </div>
                                </div>

                                <p style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)', margin: '4px 0 -4px' }}>Spouse Details (if applicable)</p>
                                <div className="form-grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Spouse Name</label>
                                    <input type="text" className="glass-input" value={borrowerProfileForm.spouse_name} onChange={e => setBorrowerProfileForm(prev => ({ ...prev, spouse_name: e.target.value }))} />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Spouse NIC Number</label>
                                    <input type="text" className="glass-input" value={borrowerProfileForm.spouse_nic} onChange={e => setBorrowerProfileForm(prev => ({ ...prev, spouse_nic: e.target.value }))} />
                                  </div>
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Spouse Occupation</label>
                                  <input type="text" className="glass-input" value={borrowerProfileForm.spouse_occupation} onChange={e => setBorrowerProfileForm(prev => ({ ...prev, spouse_occupation: e.target.value }))} />
                                </div>
                              </div>
                            </div>

                            {/* --- SECTION 3: LOAN DETAILS & AGENT --- */}
                            <div style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', margin: '0', fontSize: '15px' }}>
                                <Landmark className="icon" /> 3. LOAN SCHEDULING DETAILS
                              </p>

                              <div>
                                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>PRINCIPAL AMOUNT (LKR) *</label>
                                <input id="principal_amount" type="number" min="1" className="glass-input" style={{ borderColor: validationErrors.principal_amount ? 'var(--accent-rose)' : '', borderWidth: validationErrors.principal_amount ? '2px' : '' }} placeholder="e.g. 50000" value={newLoan.principal_amount} onChange={e => { setNewLoan(prev => ({ ...prev, principal_amount: e.target.value })); clearFieldError('principal_amount'); }} />
                                {validationErrors.principal_amount && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors.principal_amount}</span>}
                              </div>

                              <div className="form-grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>INTEREST RATE (%) *</label>
                                  <input id="interest_rate" type="number" step="0.01" min="0" className="glass-input" style={{ borderColor: validationErrors.interest_rate ? 'var(--accent-rose)' : '', borderWidth: validationErrors.interest_rate ? '2px' : '' }} placeholder="2.00" value={newLoan.interest_rate} onChange={e => { setNewLoan(prev => ({ ...prev, interest_rate: e.target.value })); clearFieldError('interest_rate'); }} />
                                  {validationErrors.interest_rate && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors.interest_rate}</span>}
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>ACCRUAL FREQUENCY</label>
                                  <select required className="glass-input" value={newLoan.interest_type} onChange={e => setNewLoan(prev => ({ ...prev, interest_type: e.target.value }))}>
                                    <option value="daily">Daily Accumulation</option>
                                    <option value="weekly">Weekly Accumulation</option>
                                    <option value="monthly">Monthly Accumulation</option>
                                  </select>
                                </div>
                              </div>

                              <div className="form-grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>LOAN TERM</label>
                                  <select required className="glass-input" value={newLoan.collection_mode} onChange={e => setNewLoan(prev => ({ ...prev, collection_mode: e.target.value }))}>
                                    <option value="open_ended">Open-Ended (Runs until fully paid)</option>
                                    <option value="fixed_term">Fixed Term (Set duration)</option>
                                  </select>
                                </div>
                                {newLoan.collection_mode === 'fixed_term' && (
                                  <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>
                                      DURATION (in {newLoan.interest_type === 'daily' ? 'days' : newLoan.interest_type === 'weekly' ? 'weeks' : 'months'}) *
                                    </label>
                                    <input type="number" min="1" required className="glass-input" placeholder="e.g. 30" value={newLoan.duration_periods} onChange={e => setNewLoan(prev => ({ ...prev, duration_periods: e.target.value }))} />
                                  </div>
                                )}
                              </div>

                              {newLoan.principal_amount > 0 && newLoan.interest_rate > 0 && (
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>
                                  {(() => {
                                    const p = parseFloat(newLoan.principal_amount) || 0;
                                    const r = parseFloat(newLoan.interest_rate) || 0;
                                    const perPeriod = p * (r / 100);
                                    return `Interest-only loan: borrower owes LKR ${perPeriod.toLocaleString(undefined, { maximumFractionDigits: 2 })} interest every ${newLoan.interest_type === 'daily' ? 'day' : newLoan.interest_type === 'weekly' ? 'week' : 'month'} until the LKR ${p.toLocaleString()} principal is repaid in full (whenever the borrower is ready).`;
                                  })()}
                                </p>
                              )}

                              <div>
                                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>ASSIGN COLLECTION AGENT</label>
                                <select className="glass-input" value={newLoan.assigned_agent_id} onChange={e => setNewLoan(prev => ({ ...prev, assigned_agent_id: e.target.value }))}>
                                  <option value="">-- No Agent (Self Collect) --</option>
                                  {agentsList.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* --- SECTION 4: GUARANTOR CHECKBOX --- */}
                            <div style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(255,255,255,0.01)' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', margin: 0 }}>
                                <input type="checkbox" checked={includeGuarantor} onChange={e => {
                                  setIncludeGuarantor(e.target.checked);
                                  if (!e.target.checked && giveLoanStep === 2) {
                                    setGiveLoanStep(1);
                                  }
                                }} />
                                <ShieldCheck className="icon" /> ADD GUARANTOR DETAILS (OPTIONAL)
                              </label>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '24px', marginTop: '-8px' }}>
                                Checking this will add a second step to fill in the guarantor personal, income and expense details.
                              </span>
                            </div>

                            {/* Navigation Buttons for Step 1 */}
                            {includeGuarantor ? (
                              <button 
                                type="button" 
                                className="glass-btn glass-btn-emerald" 
                                onClick={handleNextStep}
                                style={{ width: '100%', marginTop: '10px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '15px' }}
                              >
                                Continue to Guarantor Details <ArrowRight className="icon" />
                              </button>
                            ) : (
                              <button 
                                type="submit" 
                                className="glass-btn glass-btn-emerald" 
                                disabled={loading} 
                                style={{ width: '100%', marginTop: '10px', padding: '16px', fontSize: '15px' }}
                              >
                                Disburse Cash Loan
                              </button>
                            )}
                          </div>
                        )}

                        {giveLoanStep === 2 && includeGuarantor && (
                          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', margin: '0', fontSize: '15px' }}>
                                <ShieldCheck className="icon" /> 4. GUARANTOR DETAILS
                              </p>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div className="form-grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Full Name *</label>
                                    <input id="guarantor_full_name" type="text" className="glass-input" style={{ borderColor: validationErrors.guarantor_full_name ? 'var(--accent-rose)' : '', borderWidth: validationErrors.guarantor_full_name ? '2px' : '' }} value={guarantorForm.full_name} onChange={e => { setGuarantorForm(prev => ({ ...prev, full_name: e.target.value })); clearFieldError('guarantor_full_name'); }} />
                                    {validationErrors.guarantor_full_name && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors.guarantor_full_name}</span>}
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>NIC Number *</label>
                                    <input id="guarantor_nic_number" type="text" className="glass-input" style={{ borderColor: validationErrors.guarantor_nic_number ? 'var(--accent-rose)' : '', borderWidth: validationErrors.guarantor_nic_number ? '2px' : '' }} placeholder="e.g. 199012345678 or 123456789V" value={guarantorForm.nic_number} onChange={e => { setGuarantorForm(prev => ({ ...prev, nic_number: e.target.value })); clearFieldError('guarantor_nic_number'); }} />
                                    {validationErrors.guarantor_nic_number && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors.guarantor_nic_number}</span>}
                                  </div>
                                </div>

                                <div className="form-grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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

                                <div>
                                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Phone Number *</label>
                                  <input id="guarantor_phone" type="tel" className="glass-input" style={{ borderColor: validationErrors.guarantor_phone ? 'var(--accent-rose)' : '', borderWidth: validationErrors.guarantor_phone ? '2px' : '' }} value={guarantorForm.phone} onChange={e => { setGuarantorForm(prev => ({ ...prev, phone: e.target.value })); clearFieldError('guarantor_phone'); }} />
                                  {validationErrors.guarantor_phone && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors.guarantor_phone}</span>}
                                </div>

                                <div>
                                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Address *</label>
                                  <input id="guarantor_address" type="text" className="glass-input" style={{ borderColor: validationErrors.guarantor_address ? 'var(--accent-rose)' : '', borderWidth: validationErrors.guarantor_address ? '2px' : '' }} value={guarantorForm.address} onChange={e => { setGuarantorForm(prev => ({ ...prev, address: e.target.value })); clearFieldError('guarantor_address'); }} />
                                  {validationErrors.guarantor_address && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors.guarantor_address}</span>}
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
                                  <div className="form-grid-3-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                    <input type="number" min="0" className="glass-input" placeholder="Business" value={guarantorForm.monthly_income_business} onChange={e => setGuarantorForm(prev => ({ ...prev, monthly_income_business: e.target.value }))} />
                                    <input type="number" min="0" className="glass-input" placeholder="Agriculture" value={guarantorForm.monthly_income_agriculture} onChange={e => setGuarantorForm(prev => ({ ...prev, monthly_income_agriculture: e.target.value }))} />
                                    <input type="number" min="0" className="glass-input" placeholder="Other" value={guarantorForm.monthly_income_other} onChange={e => setGuarantorForm(prev => ({ ...prev, monthly_income_other: e.target.value }))} />
                                  </div>
                                </div>

                                <div>
                                  <p style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>Monthly Expense (LKR)</p>
                                  <div className="form-grid-3-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                    <input type="number" min="0" className="glass-input" placeholder="Food" value={guarantorForm.monthly_expense_food} onChange={e => setGuarantorForm(prev => ({ ...prev, monthly_expense_food: e.target.value }))} />
                                    <input type="number" min="0" className="glass-input" placeholder="House Rent" value={guarantorForm.monthly_expense_rent} onChange={e => setGuarantorForm(prev => ({ ...prev, monthly_expense_rent: e.target.value }))} />
                                    <input type="number" min="0" className="glass-input" placeholder="Other" value={guarantorForm.monthly_expense_other} onChange={e => setGuarantorForm(prev => ({ ...prev, monthly_expense_other: e.target.value }))} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Navigation Buttons for Step 2 */}
                            <div style={{ display: 'flex', gap: '12px' }}>
                              <button 
                                type="button" 
                                className="glass-btn glass-btn-secondary" 
                                onClick={() => setGiveLoanStep(1)}
                                style={{ flex: 1, padding: '16px', fontSize: '15px' }}
                              >
                                Back to Step 1
                              </button>
                              <button 
                                type="submit" 
                                className="glass-btn glass-btn-emerald" 
                                disabled={loading} 
                                style={{ flex: 2, padding: '16px', fontSize: '15px' }}
                              >
                                Disburse Cash Loan
                              </button>
                            </div>
                          </div>
                        )}
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* View 3: Check Loans & ledger list */}
            {view === 'loans' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button className="glass-btn glass-btn-secondary" style={{ fontSize: '15px', fontWeight: 'bold' }} onClick={() => setView('dashboard')}>
                    <ArrowLeft className="icon" /> Back to Main Menu
                  </button>
                  
                  {/* Small, non-intrusive Manual Accrual button trigger */}
                  <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }} onClick={handleForceAccrue} disabled={loading}>
                    <RefreshCcw className="icon" /> Update Interest Now
                  </button>
                </div>

                {/* Overdue loans card */}
                {adminData.overdueLoans.length > 0 && (
                  <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-rose)' }}>
                    <h3 style={{ fontSize: '24px', marginBottom: '16px', color: 'var(--accent-rose)' }}><AlertTriangle className="icon" /> Overdue Accounts</h3>
                    
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
                              <span style={{ color: 'var(--text-muted)', display: 'flex' }}><ChevronRight /></span>
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
                    <ArrowLeft className="icon" /> Back to Main Menu
                  </button>
                </div>

                <div className="glass-card">
                  <h3 style={{ fontSize: '26px', marginBottom: '20px' }}><TrendingUp className="icon" /> Agent Collections Today</h3>
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
                    <ArrowLeft className="icon" /> Back to Main Menu
                  </button>
                </div>

                {/* Agent cash-in-hand reconciliation */}
                <div className="glass-card">
                  <h3 style={{ fontSize: '22px', marginBottom: '16px' }}><Briefcase className="icon" /> Agent Cash-in-Hand Reconciliation</h3>
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

                              <span className="mobile-row-card-label">Handed Over</span>
                              <span className="mobile-row-card-value">LKR {a.totalRemitted.toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Pending / recent handovers */}
                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ fontSize: '22px', margin: 0 }}><Truck className="icon" /> Cash Handovers</h3>
                    <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={downloadRemittancesCsv} disabled={remittances.length === 0}>
                      <Download className="icon" /> Export CSV
                    </button>
                  </div>
                  {remittances.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No cash handovers submitted yet.</p>
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
                          ) : r.status === 'rejected' ? (
                            <span className="badge badge-defaulted" title={r.rejection_reason || ''}>Rejected</span>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button className="glass-btn glass-btn-emerald" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => handleVerifyRemittance(r.id)} disabled={loading}>
                                Verify
                              </button>
                              <button className="glass-btn glass-btn-rose" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => handleRejectRemittance(r.id)} disabled={loading}>
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ledger / trial balance report */}
                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ fontSize: '22px' }}><BookOpen className="icon" /> Ledger / Trial Balance</h3>
                    <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={downloadLedgerCsv} disabled={!ledgerReport}>
                      <Download className="icon" /> Export CSV
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>From</label>
                      <input type="date" className="glass-input" style={{ padding: '6px 10px' }} value={ledgerFrom} onChange={e => setLedgerFrom(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>To</label>
                      <input type="date" className="glass-input" style={{ padding: '6px 10px' }} value={ledgerTo} onChange={e => setLedgerTo(e.target.value)} />
                    </div>
                    <button className="glass-btn glass-btn-secondary" style={{ padding: '7px 14px', fontSize: '12px' }} onClick={handleFetchLedgerReport} disabled={loading}>
                      Apply Range
                    </button>
                    {(ledgerFrom || ledgerTo) && (
                      <button className="glass-btn glass-btn-secondary" style={{ padding: '7px 14px', fontSize: '12px' }} onClick={() => { setLedgerFrom(''); setLedgerTo(''); handleFetchLedgerReport('', ''); }} disabled={loading}>
                        Clear (All-Time)
                      </button>
                    )}
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
                                {ledgerReport.totals.balanced ? <><CircleCheck className="icon" /> Balanced</> : <><CircleAlert className="icon" /> Out of balance</>}
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
                              {ledgerReport.totals.balanced ? <><CircleCheck className="icon" /> Balanced</> : <><CircleAlert className="icon" /> Out of balance</>}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '22px', margin: 0 }}><User className="icon" /> User Management</h3>
                    <button type="button" className="glass-btn" style={{ padding: '10px 18px', fontSize: '14px' }} onClick={() => setShowAddUser(v => !v)}>
                      <UserPlus className="icon" /> {showAddUser ? 'Cancel' : 'Add User'}
                    </button>
                  </div>

                  {showAddUser && (
                    <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px', padding: '18px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)' }}>
                      <div className="form-grid-2-col">
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>FULL NAME</label>
                          <input required type="text" className="glass-input" value={newUserForm.name} onChange={e => setNewUserForm(prev => ({ ...prev, name: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>PHONE NUMBER</label>
                          <input required type="tel" className="glass-input" placeholder="e.g. 0771234567" value={newUserForm.phone} onChange={e => setNewUserForm(prev => ({ ...prev, phone: e.target.value }))} />
                        </div>
                      </div>
                      <div className="form-grid-2-col">
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>EMAIL (OPTIONAL)</label>
                          <input type="email" className="glass-input" placeholder="e.g. name@example.com" value={newUserForm.email} onChange={e => setNewUserForm(prev => ({ ...prev, email: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>GENDER</label>
                          <select className="glass-input" value={newUserForm.gender} onChange={e => setNewUserForm(prev => ({ ...prev, gender: e.target.value }))}>
                            <option value="">-- Select --</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-grid-2-col">
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>ROLE</label>
                          <select className="glass-input" value={newUserForm.role} onChange={e => setNewUserForm(prev => ({ ...prev, role: e.target.value }))}>
                            <option value="agent">Agent</option>
                            <option value="admin">Admin</option>
                            <option value="borrower">Borrower</option>
                          </select>
                        </div>
                        <div>
                          {newUserForm.role === 'borrower' ? (
                            <>
                              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold', opacity: 0.5 }}>PASSWORD (NOT REQUIRED)</label>
                              <input disabled type="text" className="glass-input" placeholder="Borrowers have no login access" value="" />
                            </>
                          ) : (
                            <>
                              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>PASSWORD</label>
                              <input required type="text" className="glass-input" placeholder="Set an initial password" value={newUserForm.password} onChange={e => setNewUserForm(prev => ({ ...prev, password: e.target.value }))} />
                            </>
                          )}
                        </div>
                      </div>
                      <button type="submit" className="glass-btn glass-btn-emerald" disabled={loading} style={{ alignSelf: 'flex-start', padding: '10px 24px' }}>
                        <ClipboardCheck className="icon" /> Create User
                      </button>
                    </form>
                  )}

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
                            <td style={{ fontSize: '12px' }}>{u.phone}</td>
                            <td>
                              <span className={`badge ${u.is_active ? 'badge-active' : 'badge-defaulted'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                            </td>
                            <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button className="glass-btn glass-btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleToggleUserStatus(u)} disabled={loading || u.id === user.id}>
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button className="glass-btn glass-btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleStartEditUser(u)} disabled={loading}>
                                Edit Details
                              </button>
                              <button className="glass-btn glass-btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleResetUserPassword(u)} disabled={loading}>
                                Reset Password
                              </button>
                              <button className="glass-btn glass-btn-rose" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleDeleteUser(u)} disabled={loading || u.id === user.id}>
                                <Trash2 className="icon" /> Delete
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

                          <span className="mobile-row-card-label">Phone</span>
                          <span className="mobile-row-card-value">{u.phone}</span>
                        </div>
                        <div className="mobile-row-card-actions">
                          <button className="glass-btn glass-btn-secondary" onClick={() => handleToggleUserStatus(u)} disabled={loading || u.id === user.id}>
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button className="glass-btn glass-btn-secondary" onClick={() => handleStartEditUser(u)} disabled={loading}>
                            Edit Details
                          </button>
                          <button className="glass-btn glass-btn-secondary" onClick={() => handleResetUserPassword(u)} disabled={loading}>
                            Reset Password
                          </button>
                          <button className="glass-btn glass-btn-rose" onClick={() => handleDeleteUser(u)} disabled={loading || u.id === user.id}>
                            <Trash2 className="icon" /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Edit User Modal (Admin only) */}
                {editingUser && (
                  <div className="receipt-modal-overlay" onClick={() => setEditingUser(null)}>
                    <div className="receipt-modal-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><User className="icon" /> Edit User Details</h3>
                        <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setEditingUser(null)}>
                          Close
                        </button>
                      </div>
                      <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>FULL NAME</label>
                          <input required type="text" className="glass-input" value={editUserForm.name} onChange={e => setEditUserForm(prev => ({ ...prev, name: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>PHONE NUMBER</label>
                          <input required type="tel" className="glass-input" value={editUserForm.phone} onChange={e => setEditUserForm(prev => ({ ...prev, phone: e.target.value }))} />
                        </div>
                        <div className="form-grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>EMAIL (OPTIONAL)</label>
                            <input type="email" className="glass-input" value={editUserForm.email || ''} onChange={e => setEditUserForm(prev => ({ ...prev, email: e.target.value }))} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>GENDER</label>
                            <select className="glass-input" value={editUserForm.gender || ''} onChange={e => setEditUserForm(prev => ({ ...prev, gender: e.target.value }))}>
                              <option value="">Select Gender</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>ROLE</label>
                          <select className="glass-input" value={editUserForm.role} onChange={e => setEditUserForm(prev => ({ ...prev, role: e.target.value }))} disabled={editingUser.id === user.id}>
                            <option value="agent">Agent</option>
                            <option value="admin">Admin</option>
                            <option value="borrower">Borrower</option>
                          </select>
                          {editingUser.id === user.id && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>You cannot change your own role.</span>
                          )}
                        </div>
                        <button type="submit" className="glass-btn glass-btn-emerald" disabled={loading} style={{ width: '100%', padding: '12px', marginTop: '10px' }}>
                          <ClipboardCheck className="icon" /> Save Changes
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {view === 'audit-log' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button className="glass-btn glass-btn-secondary" style={{ fontSize: '15px', fontWeight: 'bold' }} onClick={() => setView('dashboard')}>
                    <ArrowLeft className="icon" /> Back to Main Menu
                  </button>
                </div>
                <AuditLogLoader />
              </div>
            )}

            {view === 'payment-history' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button className="glass-btn glass-btn-secondary" style={{ fontSize: '15px', fontWeight: 'bold' }} onClick={() => setView('dashboard')}>
                    <ArrowLeft className="icon" /> Back to Main Menu
                  </button>
                </div>
                <PaymentHistoryLoader />
              </div>
            )}

          </div>
        )}

        {/* Removed duplicate helper from here as it is integrated inside Tab 2 */}

        {/* ----------------- BORROWER DASHBOARD ----------------- */}
        {token && user && user.role === 'borrower' && view === 'dashboard' && borrowerData && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* KPI Metrics */}
            <div className="grid-cols-analytics">
              <div className="kpi-card kpi-card-blue">
                <span className="kpi-lbl">Total Outstanding</span>
                <h3 className="kpi-val">LKR {(parseFloat(borrowerData.summary.totalPrincipalOutstanding) + parseFloat(borrowerData.summary.totalInterestBalance)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
              </div>
              <div className="kpi-card kpi-card-rose">
                <span className="kpi-lbl">Principal Outstanding</span>
                <h3 className="kpi-val">LKR {parseFloat(borrowerData.summary.totalPrincipalOutstanding).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
              </div>
              <div className="kpi-card kpi-card-rose">
                <span className="kpi-lbl">Interest Balance</span>
                <h3 className="kpi-val">LKR {parseFloat(borrowerData.summary.totalInterestBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
              </div>
            </div>

            <div className="responsive-grid-2-col">
              {/* Active Loans */}
              <div className="glass-card">
                <h3 style={{ fontSize: '24px', marginBottom: '16px' }}><ClipboardList className="icon" /> My Active Loans</h3>
                {borrowerData.loans.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>You do not have any active loans.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {borrowerData.loans.map(loan => (
                      <div key={loan.id} style={{ padding: '16px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>LKR {parseFloat(loan.principal_amount).toLocaleString()} Loan</strong>
                            <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                              Rate: {loan.interest_rate}% ({loan.interest_type})
                            </span>
                            <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>
                              Assigned Agent: {loan.agent_name || 'Office direct'}
                            </span>
                          </div>
                          <span className={`badge ${loan.status === 'active' ? 'badge-active' : loan.status === 'fully_paid' ? 'badge-paid' : 'badge-defaulted'}`}>
                            {loan.status}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '13px' }}>
                          <div>
                            <span style={{ color: 'var(--text-secondary)' }}>Principal Due:</span>
                            <strong style={{ display: 'block', color: 'var(--accent-rose)' }}>LKR {parseFloat(loan.principal_outstanding).toLocaleString()}</strong>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Interest Balance:</span>
                            <strong style={{ display: 'block', color: 'var(--accent-rose)' }}>LKR {parseFloat(loan.interest_balance).toLocaleString()}</strong>
                          </div>
                        </div>
                        <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
                          <button type="button" className="glass-btn glass-btn-secondary" style={{ flex: 1, padding: '6px 12px', fontSize: '12px' }} onClick={() => viewStatement(loan.id)}>
                            <ScrollText className="icon" /> View Statement
                          </button>
                          <button type="button" className="glass-btn glass-btn-emerald" style={{ flex: 1, padding: '6px 12px', fontSize: '12px' }} onClick={() => resetBorrowerPaymentForm(loan.id)}>
                            <CreditCard className="icon" /> Pay Now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Digital Payment */}
              <div className="glass-card">
                <h3 style={{ fontSize: '24px', marginBottom: '8px' }}><CreditCard className="icon" /> Submit Digital Payment</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
                  Select an active loan and submit digital proof of your payment (Bank transfer receipt/screenshot).
                </p>

                <form onSubmit={handleBorrowerPayment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>SELECT LOAN</label>
                    <select required className="glass-input" value={borrowerPayment.loan_id} onChange={e => resetBorrowerPaymentForm(e.target.value)}>
                      <option value="">-- Choose Loan --</option>
                      {borrowerData.loans.filter(l => l.status === 'active').map(loan => (
                        <option key={loan.id} value={loan.id}>
                          LKR {parseFloat(loan.principal_amount).toLocaleString()} Loan (Due: LKR {(parseFloat(loan.principal_outstanding) + parseFloat(loan.interest_balance)).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>PAYMENT BUCKET</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="button"
                        className={`glass-btn ${borrowerPayment.payment_type === 'interest' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
                        style={{ flex: 1 }}
                        onClick={() => setBorrowerPayment(prev => ({ ...prev, payment_type: 'interest', amount: '' }))}>
                        Interest Due
                      </button>
                      <button type="button"
                        className={`glass-btn ${borrowerPayment.payment_type === 'principal' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
                        style={{ flex: 1 }}
                        onClick={() => setBorrowerPayment(prev => ({ ...prev, payment_type: 'principal', amount: '' }))}>
                        Principal Repayment
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>
                      {borrowerPayment.payment_type === 'interest' ? 'INTEREST AMOUNT (LKR)' : 'PRINCIPAL AMOUNT (LKR)'}
                    </label>
                    <input type="number" required min="1" className="glass-input" placeholder="Enter amount to pay" value={borrowerPayment.amount} onChange={e => setBorrowerPayment(prev => ({ ...prev, amount: e.target.value }))} />
                    {borrowerPayment.loan_id && (() => {
                      const loan = borrowerData.loans.find(l => l.id === borrowerPayment.loan_id);
                      if (!loan) return null;
                      const maxAmount = borrowerPayment.payment_type === 'interest' ? parseFloat(loan.interest_balance) : parseFloat(loan.principal_outstanding);
                      if (maxAmount <= 0) return null;
                      return (
                        <button type="button" className="glass-btn glass-btn-secondary" style={{ marginTop: '8px', padding: '4px 8px', fontSize: '11px', borderRadius: '4px' }} onClick={() => setBorrowerPayment(prev => ({ ...prev, amount: maxAmount.toString() }))}>
                          Pay full outstanding (LKR {maxAmount.toLocaleString()})
                        </button>
                      );
                    })()}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>DIGITAL METHOD</label>
                    <select required className="glass-input" value={borrowerPayment.payment_method} onChange={e => setBorrowerPayment(prev => ({ ...prev, payment_method: e.target.value }))}>
                      <option value="bank_transfer">🏦 Bank Deposit / Transfer</option>
                      <option value="mobile_wallet">📱 Mobile Wallet (eZ Cash / mCash)</option>
                      <option value="card">💳 Credit/Debit Card</option>
                    </select>
                  </div>

                  {/* Dynamic Instructions */}
                  <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-glass)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {borrowerPayment.payment_method === 'bank_transfer' && (
                      <div>
                        <strong>Bank Instructions:</strong><br />
                        Bank: <strong>LendBuddy Central Bank</strong><br />
                        Account: <strong>1000-5491-0238</strong><br />
                        Branch: <strong>Colombo Office</strong><br />
                        Please enter your phone number as reference!
                      </div>
                    )}
                    {borrowerPayment.payment_method === 'mobile_wallet' && (
                      <div>
                        <strong>Mobile Wallet Instructions:</strong><br />
                        Send eZ Cash / mCash directly to:<br />
                        Mobile No: <strong>+94 77 404 8194</strong><br />
                        Add note: <strong>"Loan Payment"</strong>
                      </div>
                    )}
                    {borrowerPayment.payment_method === 'card' && (
                      <div>
                        <strong>Card Payment Instructions:</strong><br />
                        We accept Visa/Mastercard credit and debit cards.<br />
                        Please call our billing line <strong>+94 77 123 4567</strong> for secure processing.
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>RECEIPT UPLOAD (TRANSFER SCREENSHOT / RECEIPT)</label>
                    <input type="file" accept="image/*" className="glass-input" onChange={handleBorrowerFileChange} />
                    {borrowerPayment.proof_image && (
                      <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check className="icon" /> Receipt screenshot attached
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>PAYMENT REFERENCE / NOTES (OPTIONAL)</label>
                    <input type="text" className="glass-input" placeholder="e.g. Tx Ref: 981726, paid from BOC account" value={borrowerPayment.notes} onChange={e => setBorrowerPayment(prev => ({ ...prev, notes: e.target.value }))} />
                  </div>

                  <button type="submit" className="glass-btn glass-btn-emerald" style={{ width: '100%', padding: '12px' }} disabled={loading}>
                    {loading ? 'Submitting...' : 'Submit Payment Proof'}
                  </button>
                </form>
              </div>
            </div>

            {/* Payment History */}
            <div className="glass-card">
              <h3 style={{ fontSize: '24px', marginBottom: '16px' }}><ScrollText className="icon" /> My Payment History</h3>
              {borrowerData.recentTransactions.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No payments recorded yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="glass-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount Paid</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {borrowerData.recentTransactions.map(tx => (
                        <tr key={tx.id}>
                          <td>{new Date(tx.payment_date).toLocaleString()}</td>
                          <td style={{ textTransform: 'capitalize' }}>{tx.payment_type}</td>
                          <td style={{ color: 'var(--accent-emerald)', fontWeight: 'bold' }}>LKR {parseFloat(tx.amount).toLocaleString()}</td>
                          <td style={{ textTransform: 'capitalize' }}>{(tx.payment_method || 'cash').replace('_', ' ')}</td>
                          <td><span className="badge badge-active">Recorded</span></td>
                          <td>
                            <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px' }} onClick={() => handleOpenReceipt(tx)}>
                              Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

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
                    <h3 style={{ fontSize: '26px', marginBottom: '8px' }}><Banknote className="icon" /> Record Payment</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>Select a customer and enter the cash collected from them.</p>
                    
                    <form onSubmit={handleCollectPayment} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>CHOOSE CUSTOMER</label>
                        <select required className="glass-input" value={paymentForm.loan_id} onChange={e => resetPaymentForm(e.target.value)}>
                          <option value="">-- Select Customer --</option>
                          {agentData.assignedLoans.filter(l => l.status === 'active').map(loan => (
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
                          <option value="cash">Cash Collection</option>
                          <option value="bank_transfer">Bank Deposit / Transfer</option>
                          <option value="mobile_wallet">Mobile Wallet (eZ Cash / mCash)</option>
                          <option value="card">Card Payment</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>RECEIPT PHOTO (OPTIONAL)</label>
                        <input type="file" accept="image/*" className="glass-input" onChange={handleFileChange} />
                        {paymentForm.proof_image && (
                          <div style={{ marginTop: '10px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--accent-emerald)' }}><CircleCheck className="icon" /> Photo attached.</span>
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

                  {/* My Customers — Active / Defaulted / Closed */}
                  <div className="glass-card">
                    <h3 style={{ fontSize: '24px', marginBottom: '12px' }}><ClipboardCheck className="icon" /> My Customers</h3>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                      {['active', 'defaulted', 'closed'].map(tab => {
                        const count = agentData.assignedLoans.filter(l => tab === 'closed' ? ['fully_paid', 'written_off'].includes(l.status) : l.status === tab).length;
                        return (
                          <button key={tab} type="button"
                            className={`glass-btn ${agentCustomerTab === tab ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
                            style={{ padding: '6px 14px', fontSize: '12px', textTransform: 'capitalize' }}
                            onClick={() => setAgentCustomerTab(tab)}>
                            {tab} ({count})
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const tabLoans = agentData.assignedLoans.filter(l => agentCustomerTab === 'closed' ? ['fully_paid', 'written_off'].includes(l.status) : l.status === agentCustomerTab);
                      if (tabLoans.length === 0) {
                        return <p style={{ color: 'var(--text-muted)' }}>No {agentCustomerTab} customers.</p>;
                      }
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {tabLoans.map(loan => {
                            const status = loan.today_collection_status;
                            const statusBadge = status === 'paid'
                              ? <span className="badge badge-active">Paid Today</span>
                              : status === 'partial'
                                ? <span className="badge badge-pending">Partial</span>
                                : status === 'not_paid'
                                  ? <span className="badge badge-defaulted">Missed</span>
                                  : <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>Not Marked</span>;
                            return (
                              <div key={loan.id} style={{ padding: '16px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                                  <div>
                                    <strong style={{ display: 'block', fontSize: '15px' }}>{loan.borrower_name}</strong>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><Phone className="icon" /> {loan.borrower_phone}</span>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                      Type: <span style={{ textTransform: 'capitalize' }}>{loan.interest_type} ({loan.interest_rate}%)</span>
                                      {loan.status !== 'active' && <span> • Status: <span style={{ textTransform: 'capitalize' }}>{loan.status.replace('_', ' ')}</span></span>}
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-rose)' }}>
                                      Principal: LKR {parseFloat(loan.principal_outstanding).toLocaleString()}
                                    </span>
                                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-rose)' }}>
                                      Interest: LKR {parseFloat(loan.interest_balance).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                                {loan.status === 'active' && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                                    {statusBadge}
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                      <button className="glass-btn glass-btn-emerald" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }} onClick={() => handleMarkDailyCollection(loan.id, 'paid')} disabled={loading}>
                                        <Check className="icon" /> Paid
                                      </button>
                                      <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }} onClick={() => handleMarkDailyCollection(loan.id, 'partial')} disabled={loading}>
                                        Partial
                                      </button>
                                      <button className="glass-btn glass-btn-rose" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }} onClick={() => handleMarkDailyCollection(loan.id, 'not_paid')} disabled={loading}>
                                        <X className="icon" /> Missed
                                      </button>
                                      <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }} onClick={() => resetPaymentForm(loan.id)}>
                                        Full Form
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                </div>
              </>
            )}

            {agentSubView === 'history' && (
              /* Agent Collection log */
              <div className="glass-card">
                <h3 style={{ fontSize: '24px', marginBottom: '16px' }}><ScrollText className="icon" /> Saved Collections Today</h3>
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
                                  <FileText className="icon" /> Receipt
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
                              <FileText className="icon" /> Print Receipt
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
                  <h3 style={{ fontSize: '22px', marginBottom: '16px' }}><Landmark className="icon" /> Hand over Cash to Office</h3>
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
                    <button type="submit" className="glass-btn glass-btn-emerald" disabled={loading} style={{ width: '100%' }}>Submit Handover</button>
                  </form>
                </div>

                <div className="glass-card">
                  <h3 style={{ fontSize: '22px', marginBottom: '16px' }}><ScrollText className="icon" /> My Handover History</h3>
                  {remittances.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No cash handovers submitted yet.</p>
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

        {/* ----------------- DOUBLE-ENTRY STATEMENT AUDIT LEDGER ----------------- */}
        {token && user && view === 'ledger' && (
          !loanStatement ? (
            <div className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
              <div className="loading-spinner" />
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Loading loan file details...</p>
            </div>
          ) : (() => {
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
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Header info card */}
              <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 'bold', letterSpacing: '0.05em' }}>LOAN STATEMENT & HISTORY</span>
                  <h2 style={{ fontSize: '28px', margin: '4px 0' }}>Loan Details: {loanStatement.loan.borrower_name}</h2>
                  
                  {/* Styled responsive metrics grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px 16px', margin: '12px 0' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      Original Principal: <strong style={{ color: 'var(--text-primary)' }}>LKR {parseFloat(loanStatement.loan.principal_amount).toLocaleString()}</strong>
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      Principal Outstanding: <strong style={{ color: 'var(--accent-rose)', fontWeight: 'bold' }}>LKR {parseFloat(loanStatement.loan.principal_outstanding).toLocaleString()}</strong>
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      Interest Due: <strong style={{ color: 'var(--accent-rose)', fontWeight: 'bold' }}>LKR {parseFloat(loanStatement.loan.interest_balance).toLocaleString()}</strong>
                      {(() => {
                        const projected = projectCurrentInterestBalance(loanStatement.loan);
                        const stored = parseFloat(loanStatement.loan.interest_balance) || 0;
                        if (Math.abs(projected - stored) < 0.01) return null;
                        return (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block', marginTop: '2px' }}>
                            (Est. now: <strong style={{ color: 'var(--accent-rose)' }}>LKR {projected.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>)
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 6px', flexWrap: 'wrap' }}>
                    <span><IdCard className="icon" /> NIC Number: <strong>{loanStatement.loan.nic_number || 'N/A'}</strong></span>
                    {loanStatement.loan.nic_photo_url && (
                      <>
                        <span>•</span>
                        <a 
                          href="#" 
                          style={{ color: 'var(--accent-blue)', textDecoration: 'underline', fontWeight: '500' }}
                          onClick={(e) => {
                            e.preventDefault();
                            const win = window.open();
                            win.document.write(`<img src="${loanStatement.loan.nic_photo_url}" style="max-width:100%; height:auto; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border-radius: 8px;" />`);
                          }}
                        >
                          View NIC Photo
                        </a>
                      </>
                    )}
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 4px' }}>
                    Address: <strong>{loanStatement.loan.borrower_address || 'N/A'}</strong>
                    {loanStatement.loan.borrower_email && <> | Email: <strong>{loanStatement.loan.borrower_email}</strong></>}
                    {loanStatement.loan.borrower_gender && <> | Gender: <strong style={{ textTransform: 'capitalize' }}>{loanStatement.loan.borrower_gender}</strong></>}
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0' }}>
                    Loan Term: <strong style={{ textTransform: 'capitalize' }}>
                      {loanStatement.loan.collection_mode === 'fixed_term' ? 'Fixed Term' : 'Open-Ended'}
                    </strong>
                    {loanStatement.loan.collection_mode === 'fixed_term' && loanStatement.loan.maturity_date && (
                      <>
                        {' '}| Maturity: <strong>{new Date(loanStatement.loan.maturity_date).toLocaleDateString()}</strong>
                        {(() => {
                          const today = new Date();
                          today.setHours(0,0,0,0);
                          const maturity = new Date(loanStatement.loan.maturity_date);
                          const diffTime = maturity - today;
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          if (diffDays < 0) {
                            return <span style={{ color: 'var(--accent-rose)', marginLeft: '8px', fontWeight: 'bold' }}>(OVERDUE by {Math.abs(diffDays)} day(s))</span>;
                          } else if (diffDays === 0) {
                            return <span style={{ color: 'var(--accent-rose)', marginLeft: '8px', fontWeight: 'bold' }}>(MATURES TODAY!)</span>;
                          } else {
                            return <span style={{ color: 'var(--accent-emerald)', marginLeft: '8px' }}>({diffDays} day(s) remaining)</span>;
                          }
                        })()}
                      </>
                    )}
                  </p>
                </div>
                
                {/* Actions group with flex layout */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', width: '100%', maxWidth: '360px' }}>
                  <button className="glass-btn glass-btn-secondary" style={{ flex: 1, minWidth: '160px', padding: '10px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setShowLoanAgreement(true)}>
                    <FileText className="icon" /> Print Agreement
                  </button>
                  <button className="glass-btn glass-btn-emerald" style={{ flex: 1, minWidth: '160px', padding: '10px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => { setView('dashboard'); setSelectedLoanId(null); setLoanStatement(null); }}>
                    <ArrowLeft className="icon" /> Go Back
                  </button>
                </div>
              </div>

              {/* Tab Navigation Menu */}
              <div className="loan-file-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', gap: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '0px' }}>
                <button
                  type="button"
                  className="loan-file-tab"
                  onClick={() => setLedgerTab('passbook')}
                  style={{
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    background: 'none',
                    border: 'none',
                    borderBottom: ledgerTab === 'passbook' ? '3px solid var(--accent-blue)' : '3px solid transparent',
                    color: ledgerTab === 'passbook' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Receipt className="icon" style={{ fontSize: '16px' }} /> Passbook & Payments
                </button>
                <button
                  type="button"
                  className="loan-file-tab"
                  onClick={() => setLedgerTab('profile')}
                  style={{
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    background: 'none',
                    border: 'none',
                    borderBottom: ledgerTab === 'profile' ? '3px solid var(--accent-blue)' : '3px solid transparent',
                    color: ledgerTab === 'profile' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <ClipboardList className="icon" style={{ fontSize: '16px' }} /> Borrower Profile
                </button>
                <button
                  type="button"
                  className="loan-file-tab"
                  onClick={() => setLedgerTab('guarantor')}
                  style={{
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    background: 'none',
                    border: 'none',
                    borderBottom: ledgerTab === 'guarantor' ? '3px solid var(--accent-blue)' : '3px solid transparent',
                    color: ledgerTab === 'guarantor' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <ShieldCheck className="icon" style={{ fontSize: '16px' }} /> Guarantor Info
                </button>
                {user.role === 'admin' && (
                  <button
                    type="button"
                    className="loan-file-tab"
                    onClick={() => setLedgerTab('management')}
                    style={{
                      padding: '12px 16px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      background: 'none',
                      border: 'none',
                      borderBottom: ledgerTab === 'management' ? '3px solid var(--accent-blue)' : '3px solid transparent',
                      color: ledgerTab === 'management' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Settings className="icon" style={{ fontSize: '16px' }} /> Manage Loan
                  </button>
                )}
              </div>

              {/* TAB 1: PASSBOOK & PAYMENTS */}
              {ledgerTab === 'passbook' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {loanStatement.loan.collection_mode === 'fixed_term' && loanStatement.loan.maturity_date && (
                    <div className="glass-card">
                      <h3 style={{ fontSize: '20px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp className="icon" /> Fixed Term Progress</h3>
                      {(() => {
                        const start = new Date(loanStatement.loan.created_at);
                        const maturity = new Date(loanStatement.loan.maturity_date);
                        const today = new Date();
                        
                        const totalDays = Math.max(1, Math.round((maturity - start) / (1000 * 60 * 60 * 24)));
                        const elapsedDays = Math.max(0, Math.round((today - start) / (1000 * 60 * 60 * 24)));
                        const percent = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
                        
                        return (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                              <span>Disbursed: <strong>{start.toLocaleDateString()}</strong></span>
                              <span>Day {Math.min(totalDays, elapsedDays)} of {totalDays} ({percent.toFixed(0)}%)</span>
                              <span>Maturity: <strong>{maturity.toLocaleDateString()}</strong></span>
                            </div>
                            <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.07)', borderRadius: '5px', overflow: 'hidden' }}>
                              <div style={{ width: `${percent}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-emerald))', transition: 'width 0.4s ease' }} />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className="responsive-grid-2-col" style={{ gap: '24px' }}>
                    {/* Passbook Statement History */}
                    <div className="glass-card" style={{ cursor: 'pointer', transition: 'transform 0.2s ease, border-color 0.2s ease' }} onClick={() => setView('passbook-details')}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: 'column', gap: '8px', marginBottom: '16px' }} className="mobile-header-split">
                        <h3 style={{ fontSize: '20px', margin: 0 }}><Receipt className="icon" /> Passbook Statement (Activity Log)</h3>
                        <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '6px' }} onClick={(e) => { e.stopPropagation(); setView('passbook-details'); }}>
                          View Detailed Table
                        </button>
                      </div>
                      
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      
                      {/* Record Payment inline card */}
                      {(user.role === 'admin' || user.role === 'agent') && loanStatement.loan.status === 'active' && (
                        <div className="glass-card" onClick={(e) => e.stopPropagation()} style={{ border: '1px solid var(--border-light)', background: 'rgba(255, 255, 255, 0.01)' }}>
                          <h3 style={{ fontSize: '18px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Banknote className="icon" style={{ color: 'var(--accent-blue)' }} /> Record a Payment
                          </h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '14px' }}>
                            Enter cash collection details for this loan.
                          </p>
                          <form onSubmit={handleLedgerCollectPayment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>PAYMENT TYPE</label>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="button"
                                  className={`glass-btn ${ledgerPaymentForm.payment_type === 'interest' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
                                  style={{ flex: 1, padding: '6px 12px', fontSize: '12px' }}
                                  onClick={() => setLedgerPaymentForm(prev => ({ ...prev, payment_type: 'interest' }))}>
                                  Interest
                                </button>
                                <button type="button"
                                  className={`glass-btn ${ledgerPaymentForm.payment_type === 'principal' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
                                  style={{ flex: 1, padding: '6px 12px', fontSize: '12px' }}
                                  onClick={() => setLedgerPaymentForm(prev => ({ ...prev, payment_type: 'principal' }))}>
                                  Principal
                                </button>
                              </div>
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>AMOUNT (LKR) *</label>
                              <input required type="number" step="0.01" min="0.01" className="glass-input" placeholder="0.00"
                                value={ledgerPaymentForm.amount}
                                onChange={e => setLedgerPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                                style={{ padding: '8px 12px', fontSize: '14px' }} />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>NOTES / DESCRIPTION</label>
                              <input type="text" className="glass-input" placeholder="e.g. Week 2 payment"
                                value={ledgerPaymentForm.notes}
                                onChange={e => setLedgerPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                                style={{ padding: '8px 12px', fontSize: '13px' }} />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>RECEIPT PHOTO / PROOF</label>
                              <input type="file" accept="image/*" className="glass-input"
                                onChange={async (e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setLedgerPaymentForm(prev => ({ ...prev, proof_image: reader.result }));
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                style={{ padding: '6px', fontSize: '12px' }} />
                            </div>

                            <button type="submit" className="glass-btn glass-btn-emerald" disabled={loading} style={{ width: '100%', padding: '10px', fontSize: '14px', marginTop: '4px' }}>
                              Collect Payment
                            </button>
                          </form>
                        </div>
                      )}

                      {/* Collection Receipts ledger */}
                      <div className="glass-card">
                        <h3 style={{ fontSize: '20px', marginBottom: '16px' }}><Banknote className="icon" /> Payments Received</h3>
                        {loanStatement.payments.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No payments collected yet.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
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
                                      <Printer className="icon" /> Print
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
                        <h3 style={{ fontSize: '20px', marginBottom: '16px' }}><TrendingUp className="icon" /> Interest Charged History</h3>
                        {loanStatement.accruals.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No interest accrued yet.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
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
              )}

              {/* TAB 2: BORROWER PROFILE */}
              {ledgerTab === 'profile' && (
                <div className="animate-fade-in">
                  {(loanStatement.loan.loan_purpose || loanStatement.loan.dependents_count !== null || loanStatement.loan.monthly_income !== null || loanStatement.loan.spouse_name || loanStatement.loan.borrower_address) ? (
                    <div className="glass-card">
                      <h3 style={{ fontSize: '22px', marginBottom: '16px' }}><ClipboardList className="icon" /> Borrower Profile Details</h3>
                      <div className="responsive-grid-2-col" style={{ rowGap: '10px' }}>
                        <div style={{ gridColumn: '1 / -1' }}><strong>Address:</strong> {loanStatement.loan.borrower_address || '-'}</div>
                        <div style={{ gridColumn: '1 / -1' }}><strong>Purpose of Loan:</strong> {loanStatement.loan.loan_purpose || '-'}</div>
                        <div><strong>Dependents:</strong> {loanStatement.loan.dependents_count ?? '-'}</div>
                        <div><strong>Monthly Income:</strong> {loanStatement.loan.monthly_income !== null && loanStatement.loan.monthly_income !== undefined ? `LKR ${parseFloat(loanStatement.loan.monthly_income).toLocaleString()}` : '-'}</div>
                        <div><strong>Spouse Name:</strong> {loanStatement.loan.spouse_name || '-'}</div>
                        <div><strong>Spouse NIC:</strong> {loanStatement.loan.spouse_nic || '-'}</div>
                        <div style={{ gridColumn: '1 / -1' }}><strong>Spouse Occupation:</strong> {loanStatement.loan.spouse_occupation || '-'}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="glass-card">
                      <h3 style={{ fontSize: '22px', marginBottom: '8px' }}><ClipboardList className="icon" /> Borrower Profile Details</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>No profile details are on file for this borrower.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: GUARANTOR INFO */}
              {ledgerTab === 'guarantor' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {loanStatement.guarantor && (
                    <div className="glass-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '22px', margin: 0 }}><ShieldCheck className="icon" /> Guarantor Details</h3>
                        {user.role === 'admin' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }} onClick={() => handleOpenGuarantorEditor(loanStatement.guarantor)}>
                              Edit Guarantor
                            </button>
                            <button className="glass-btn glass-btn-rose" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }} onClick={handleRemoveGuarantor}>
                              <Trash2 className="icon" /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="responsive-grid-2-col" style={{ rowGap: '10px' }}>
                        <div><strong>Name:</strong> {loanStatement.guarantor.full_name}</div>
                        <div><strong>NIC:</strong> {loanStatement.guarantor.nic_number}</div>
                        <div><strong>Phone:</strong> {loanStatement.guarantor.phone}</div>
                        <div><strong>Gender:</strong> {loanStatement.guarantor.gender || '-'}</div>
                        <div><strong>Ethnicity:</strong> {loanStatement.guarantor.ethnicity || '-'}</div>
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

                  {!loanStatement.guarantor && user.role === 'admin' && (
                    <div className="glass-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <h3 style={{ fontSize: '22px', margin: '0 0 4px' }}><ShieldCheck className="icon" /> Guarantor Details</h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>No guarantor is on file for this loan.</p>
                        </div>
                        <button className="glass-btn glass-btn-emerald" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => handleOpenGuarantorEditor(null)}>
                          <ShieldCheck className="icon" /> Add Guarantor
                        </button>
                      </div>
                    </div>
                  )}

                  {showGuarantorEditor && (
                    <div className="glass-card">
                      <h3 style={{ fontSize: '22px', marginBottom: '16px' }}><ShieldCheck className="icon" /> {loanStatement.guarantor ? 'Edit' : 'Add'} Guarantor</h3>
                      <form onSubmit={handleSaveGuarantor} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="form-grid-2-col">
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Full Name *</label>
                            <input required type="text" className="glass-input" value={guarantorEditForm.full_name} onChange={e => setGuarantorEditForm(prev => ({ ...prev, full_name: e.target.value }))} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>NIC Number *</label>
                            <input required type="text" className="glass-input" placeholder="e.g. 199012345678 or 123456789V" value={guarantorEditForm.nic_number} onChange={e => setGuarantorEditForm(prev => ({ ...prev, nic_number: e.target.value }))} />
                          </div>
                        </div>
                        <div className="form-grid-2-col">
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Gender</label>
                            <select className="glass-input" value={guarantorEditForm.gender} onChange={e => setGuarantorEditForm(prev => ({ ...prev, gender: e.target.value }))}>
                              <option value="">-- Select --</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Ethnicity</label>
                            <input type="text" className="glass-input" value={guarantorEditForm.ethnicity} onChange={e => setGuarantorEditForm(prev => ({ ...prev, ethnicity: e.target.value }))} />
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Phone *</label>
                          <input required type="tel" className="glass-input" value={guarantorEditForm.phone} onChange={e => setGuarantorEditForm(prev => ({ ...prev, phone: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Address *</label>
                          <input required type="text" className="glass-input" value={guarantorEditForm.address} onChange={e => setGuarantorEditForm(prev => ({ ...prev, address: e.target.value }))} />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                          <input type="checkbox" checked={guarantorEditForm.protected_under_debt_act} onChange={e => setGuarantorEditForm(prev => ({ ...prev, protected_under_debt_act: e.target.checked }))} />
                          Protected under debt-recovery act
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                          <input type="checkbox" checked={guarantorEditForm.has_pending_court_cases} onChange={e => setGuarantorEditForm(prev => ({ ...prev, has_pending_court_cases: e.target.checked }))} />
                          Has pending court cases
                        </label>
                        <p style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)', margin: '4px 0 -4px' }}>Monthly Income (LKR)</p>
                        <div className="form-grid-2-col">
                          <input type="number" min="0" className="glass-input" placeholder="Business" value={guarantorEditForm.monthly_income_business} onChange={e => setGuarantorEditForm(prev => ({ ...prev, monthly_income_business: e.target.value }))} />
                          <input type="number" min="0" className="glass-input" placeholder="Agriculture" value={guarantorEditForm.monthly_income_agriculture} onChange={e => setGuarantorEditForm(prev => ({ ...prev, monthly_income_agriculture: e.target.value }))} />
                        </div>
                        <input type="number" min="0" className="glass-input" placeholder="Other" value={guarantorEditForm.monthly_income_other} onChange={e => setGuarantorEditForm(prev => ({ ...prev, monthly_income_other: e.target.value }))} />
                        <p style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)', margin: '4px 0 -4px' }}>Monthly Expense (LKR)</p>
                        <div className="form-grid-2-col">
                          <input type="number" min="0" className="glass-input" placeholder="Food" value={guarantorEditForm.monthly_expense_food} onChange={e => setGuarantorEditForm(prev => ({ ...prev, monthly_expense_food: e.target.value }))} />
                          <input type="number" min="0" className="glass-input" placeholder="House Rent" value={guarantorEditForm.monthly_expense_rent} onChange={e => setGuarantorEditForm(prev => ({ ...prev, monthly_expense_rent: e.target.value }))} />
                        </div>
                        <input type="number" min="0" className="glass-input" placeholder="Other" value={guarantorEditForm.monthly_expense_other} onChange={e => setGuarantorEditForm(prev => ({ ...prev, monthly_expense_other: e.target.value }))} />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                          <button type="submit" className="glass-btn glass-btn-emerald" disabled={loading} style={{ flex: 1 }}>Save Guarantor</button>
                          <button type="button" className="glass-btn glass-btn-secondary" onClick={() => setShowGuarantorEditor(false)}>Cancel</button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: MANAGE LOAN */}
              {ledgerTab === 'management' && user.role === 'admin' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {loanStatement.loan.status === 'active' && (
                    <div className="glass-card">
                      <h3 style={{ fontSize: '22px', marginBottom: '16px' }}><Settings className="icon" /> Loan Management</h3>
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
                            <button type="submit" className="glass-btn glass-btn-secondary" disabled={loading} style={{ width: '100%' }}>Save Changes</button>
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
                            <button type="submit" className="glass-btn glass-btn-secondary" disabled={loading} style={{ width: '100%' }}>Apply Penalty</button>
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
                              <Ban className="icon" /> Mark Defaulted
                            </button>
                          </div>

                          <h4 style={{ fontSize: '15px', margin: '16px 0 10px' }}>Write Off as Bad Debt</h4>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px' }}>Permanently closes this loan and posts the remaining balance to the ledger as unrecoverable. Use only when the debt will never be collected.</p>
                          <button type="button" className="glass-btn glass-btn-rose" disabled={loading} onClick={handleWriteOffLoan} style={{ width: '100%' }}>
                            <Ban className="icon" /> Write Off Loan
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {loanStatement.loan.status === 'defaulted' && (
                    <div className="glass-card">
                      <h3 style={{ fontSize: '22px', marginBottom: '8px' }}><Settings className="icon" /> Loan Management</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                        This loan is defaulted (Reason: {loanStatement.loan.default_reason || 'N/A'}). No payments can be recorded until it's reinstated.
                      </p>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button type="button" className="glass-btn glass-btn-emerald" disabled={loading} onClick={handleReinstateLoan}>
                          <RefreshCcw className="icon" /> Reinstate to Active
                        </button>
                        <button type="button" className="glass-btn glass-btn-rose" disabled={loading} onClick={handleWriteOffLoan}>
                          <Ban className="icon" /> Write Off as Bad Debt
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          );
        })()
      )}

      {/* ----------------- CHRONOLOGICAL DETAILED PASSBOOK TABLE PAGE ----------------- */}
      {token && user && view === 'passbook-details' && (
        !loanStatement ? (
          <div className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
            <div className="loading-spinner" />
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Loading passbook details...</p>
          </div>
        ) : (() => {
          // Event compilation (chronological order)
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
              details: acc.calculation_log
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

          events.sort((a, b) => new Date(a.date) - new Date(b.date));

          let principalBal = 0;
          let interestBal = 0;
          const displayEvents = events.map(ev => {
            const delta = ev.change === 'increase' ? ev.amount : -ev.amount;
            if (ev.bucket === 'principal') {
              principalBal += delta;
            } else {
              interestBal += delta;
            }
            return { ...ev, runningPrincipalBalance: principalBal, runningInterestBalance: interestBal };
          });

          return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 'bold', letterSpacing: '0.05em' }}>DETAILED PASSBOOK STATEMENT</span>
                  <h2 style={{ fontSize: '28px', margin: '4px 0' }}>{loanStatement.loan.borrower_name}</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
                    NIC: <strong>{loanStatement.loan.nic_number || 'N/A'}</strong> | Phone: <strong>{loanStatement.loan.borrower_phone}</strong>
                  </p>
                </div>
                
                {/* Actions group with flex layout */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', width: '100%', maxWidth: '380px' }}>
                  <button type="button" className="glass-btn glass-btn-secondary" style={{ flex: 1, minWidth: '160px', padding: '10px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => window.print()}>
                    <Printer className="icon" /> Print Statement
                  </button>
                  <button type="button" className="glass-btn glass-btn-emerald" style={{ flex: 1, minWidth: '160px', padding: '10px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setView('ledger')}>
                    <ArrowLeft className="icon" /> Back to Loan File
                  </button>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '24px' }}>
                
                {/* Desktop View Table */}
                <div className="desktop-only" style={{ overflowX: 'auto' }}>
                  <table className="glass-table">
                    <thead>
                      <tr>
                        <th style={{ width: '15%' }}>Date/Time</th>
                        <th style={{ width: '15%' }}>Event Type</th>
                        <th style={{ width: '30%' }}>Calculation Details / Log</th>
                        <th style={{ width: '13%', textAlign: 'right' }}>Principal Change</th>
                        <th style={{ width: '13%', textAlign: 'right' }}>Principal Balance</th>
                        <th style={{ width: '13%', textAlign: 'right' }}>Interest Change</th>
                        <th style={{ width: '13%', textAlign: 'right' }}>Interest Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayEvents.map((entry, idx) => (
                        <tr key={idx}>
                          <td style={{ fontSize: '13px' }}>{new Date(entry.date).toLocaleString()}</td>
                          <td>
                            <span className={`badge ${entry.change === 'decrease' ? 'badge-active' : 'badge-pending'}`}>
                              {entry.type}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            {entry.details}
                          </td>
                          <td style={{
                            textAlign: 'right',
                            fontWeight: 'bold',
                            color: entry.bucket === 'principal' ? (entry.change === 'decrease' ? 'var(--accent-emerald)' : 'var(--accent-rose)') : 'inherit'
                          }}>
                            {entry.bucket === 'principal' ? (entry.change === 'increase' ? `+LKR ${entry.amount.toLocaleString()}` : `-LKR ${entry.amount.toLocaleString()}`) : '-'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                            LKR {entry.runningPrincipalBalance.toLocaleString()}
                          </td>
                          <td style={{
                            textAlign: 'right',
                            fontWeight: 'bold',
                            color: entry.bucket === 'interest' ? (entry.change === 'decrease' ? 'var(--accent-emerald)' : 'var(--accent-rose)') : 'inherit'
                          }}>
                            {entry.bucket === 'interest' ? (entry.change === 'increase' ? `+LKR ${entry.amount.toLocaleString()}` : `-LKR ${entry.amount.toLocaleString()}`) : '-'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                            LKR {entry.runningInterestBalance.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Card List */}
                <div className="mobile-only mobile-card-list">
                  {displayEvents.map((entry, idx) => (
                    <div key={idx} className={`mobile-row-card ${entry.change === 'decrease' ? 'mobile-row-card-success' : 'mobile-row-card-warning'}`}>
                      <div className="mobile-row-card-header">
                        <strong style={{ fontSize: '15px' }}>{entry.type}</strong>
                        <span className={`badge ${entry.change === 'decrease' ? 'badge-active' : 'badge-pending'}`}>
                          {entry.change === 'increase' ? 'Charged' : 'Paid'}
                        </span>
                      </div>
                      <div className="mobile-row-card-grid-compact" style={{ gridTemplateColumns: '1fr' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <strong>Date/Time:</strong> {new Date(entry.date).toLocaleString()}
                        </div>
                        {entry.details && (
                          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                            <strong>Calc Log:</strong> {entry.details}
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '4px' }}>
                          <div>
                            <span className="mobile-row-card-label" style={{ fontSize: '10px' }}>Principal Chg:</span>
                            <span className="mobile-row-card-value" style={{ 
                              fontSize: '12px',
                              color: entry.bucket === 'principal' ? (entry.change === 'decrease' ? 'var(--accent-emerald)' : 'var(--accent-rose)') : 'inherit'
                            }}>
                              {entry.bucket === 'principal' ? (entry.change === 'increase' ? `+${entry.amount.toLocaleString()}` : `-${entry.amount.toLocaleString()}`) : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="mobile-row-card-label" style={{ fontSize: '10px' }}>Interest Chg:</span>
                            <span className="mobile-row-card-value" style={{ 
                              fontSize: '12px',
                              color: entry.bucket === 'interest' ? (entry.change === 'decrease' ? 'var(--accent-emerald)' : 'var(--accent-rose)') : 'inherit'
                            }}>
                              {entry.bucket === 'interest' ? (entry.change === 'increase' ? `+${entry.amount.toLocaleString()}` : `-${entry.amount.toLocaleString()}`) : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="mobile-row-card-label" style={{ fontSize: '10px' }}>Principal Bal:</span>
                            <span className="mobile-row-card-value" style={{ fontSize: '12px' }}> LKR {entry.runningPrincipalBalance.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="mobile-row-card-label" style={{ fontSize: '10px' }}>Interest Bal:</span>
                            <span className="mobile-row-card-value" style={{ fontSize: '12px' }}> LKR {entry.runningInterestBalance.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          );
        })()
      )}

      </main>

      {/* Sticky Bottom Navigation Bar */}
      {token && user && (
        <nav className="bottom-nav-bar animate-fade-in">
          {user.role === 'admin' && (
            <>
              <button className={`bottom-nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setSelectedLoanId(null); setLoanStatement(null); }}>
                <span className="bottom-nav-icon"><Home /></span>
                <span className="bottom-nav-label">Home</span>
              </button>
              <button className={`bottom-nav-item ${view === 'create-loan' ? 'active' : ''}`} onClick={() => { setView('create-loan'); setSelectedLoanId(null); setLoanStatement(null); }}>
                <span className="bottom-nav-icon"><Banknote /></span>
                <span className="bottom-nav-label">Give Loan</span>
              </button>
              <button className={`bottom-nav-item ${view === 'loans' ? 'active' : ''}`} onClick={() => { setView('loans'); setSelectedLoanId(null); setLoanStatement(null); }}>
                <span className="bottom-nav-icon"><ClipboardList /></span>
                <span className="bottom-nav-label">Check Loans</span>
              </button>
              <button className={`bottom-nav-item ${view === 'agents' ? 'active' : ''}`} onClick={() => { setView('agents'); setSelectedLoanId(null); setLoanStatement(null); }}>
                <span className="bottom-nav-icon"><Users /></span>
                <span className="bottom-nav-label">Agent Route</span>
              </button>
              <button className={`bottom-nav-item ${view === 'admin-tools' ? 'active' : ''}`} onClick={openAdminTools}>
                <span className="bottom-nav-icon"><Landmark /></span>
                <span className="bottom-nav-label">Users & Cash</span>
              </button>
            </>
          )}
          {user.role === 'agent' && (
            <>
              <button className={`bottom-nav-item ${agentSubView === 'collect' ? 'active' : ''}`} onClick={() => setAgentSubView('collect')}>
                <span className="bottom-nav-icon"><Banknote /></span>
                <span className="bottom-nav-label">Collect</span>
              </button>
              <button className={`bottom-nav-item ${agentSubView === 'history' ? 'active' : ''}`} onClick={() => setAgentSubView('history')}>
                <span className="bottom-nav-icon"><ScrollText /></span>
                <span className="bottom-nav-label">History</span>
              </button>
              <button className={`bottom-nav-item ${agentSubView === 'remit' ? 'active' : ''}`} onClick={() => setAgentSubView('remit')}>
                <span className="bottom-nav-icon"><Landmark /></span>
                <span className="bottom-nav-label">Remit</span>
              </button>
            </>
          )}
          {user.role === 'borrower' && (
            <>
              <button className={`bottom-nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setSelectedLoanId(null); setLoanStatement(null); }}>
                <span className="bottom-nav-icon"><Home /></span>
                <span className="bottom-nav-label">Home</span>
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
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setLoading(true);
    api.get('/loans')
      .then(data => setLoans(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [fetchTrigger]);

  // Reset to page 1 whenever the visible result set changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, fetchTrigger]);

  if (loading) return <div className="glass-card" style={{ marginTop: '24px' }}><SkeletonCards count={4} lines={2} /></div>;

  // Filter loans based on search and status selector
  const filteredLoans = loans.filter(loan => {
    const matchesSearch =
      loan.borrower_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.borrower_phone.includes(searchTerm);
    const matchesFilter = statusFilter === 'all' || loan.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLoans.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedLoans = filteredLoans.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleExportCsv = () => {
    downloadCsv(
      `loans-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date Given', 'Borrower', 'Phone', 'NIC', 'Principal', 'Interest Type', 'Rate %', 'Principal Outstanding', 'Interest Due', 'Agent', 'Status'],
      filteredLoans.map(loan => [
        new Date(loan.created_at).toLocaleDateString(),
        loan.borrower_name,
        loan.borrower_phone,
        loan.nic_number || '',
        parseFloat(loan.principal_amount).toFixed(2),
        loan.interest_type,
        loan.interest_rate,
        parseFloat(loan.principal_outstanding).toFixed(2),
        parseFloat(loan.interest_balance).toFixed(2),
        loan.agent_name || 'Self-Collect',
        loan.status
      ])
    );
  };

  return (
    <div className="glass-card" style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '24px' }}><ClipboardList className="icon" /> Loan List</h3>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Simple Search Input */}
          <input
            type="text"
            className="glass-input"
            placeholder="Search name or phone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ padding: '8px 12px' }}
          />
          <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={handleExportCsv} disabled={filteredLoans.length === 0}>
            <Download className="icon" /> Export CSV
          </button>
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
                {pagedLoans.map(loan => (
                  <tr key={loan.id}>
                    <td>{new Date(loan.created_at).toLocaleDateString()}</td>
                    <td>
                      <strong style={{ display: 'block' }}>{loan.borrower_name}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}><Phone className="icon" /> {loan.borrower_phone}</span>
                      {loan.nic_number && <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}><IdCard className="icon" /> NIC: {loan.nic_number}</span>}
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
            {pagedLoans.map(loan => (
              <div 
                key={loan.id} 
                className={`mobile-row-card ${loan.status === 'active' ? 'mobile-row-card-warning' : loan.status === 'fully_paid' ? 'mobile-row-card-success' : 'mobile-row-card-danger'}`}
                onClick={() => onSelect(loan.id)}
                style={{ cursor: 'pointer', transition: 'transform 0.1s ease, box-shadow 0.1s ease' }}
              >
                <div className="mobile-row-card-header">
                  <div>
                    <strong className="mobile-row-card-title" style={{ display: 'block' }}>{loan.borrower_name}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}><Phone className="icon" /> {loan.borrower_phone}</span>
                    {loan.nic_number && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}><IdCard className="icon" /> NIC: {loan.nic_number}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`badge ${loan.status === 'active' ? 'badge-active' : loan.status === 'fully_paid' ? 'badge-paid' : 'badge-defaulted'}`}>
                      {loan.status === 'active' ? 'Unpaid' : loan.status === 'fully_paid' ? 'Paid' : loan.status}
                    </span>
                    <span style={{ color: 'var(--text-muted)', display: 'flex' }}><ChevronRight /></span>
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

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
              <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                ← Prev
              </button>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Page {currentPage} of {totalPages} ({filteredLoans.length} loans)</span>
              <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={currentPage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Quick placeholder lists
function AllLoansTable() {
  return null;
}

// Full, paginated audit trail — every mutating action in the app writes to
// audit_logs, but until this there was no page to actually browse it.
function AuditLogLoader() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (search) params.set('search', search);
    if (actionType) params.set('actionType', actionType);
    api.get(`/audit-logs?${params.toString()}`)
      .then(res => setData(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [page, search, actionType]);

  // Reset to page 1 whenever the filters change
  useEffect(() => {
    setPage(1);
  }, [search, actionType]);

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '24px' }}><ScrollText className="icon" /> Audit Log</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="glass-input"
            placeholder="Search description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '8px 12px', maxWidth: '220px' }}
          />
          <select className="glass-input" style={{ padding: '8px 12px' }} value={actionType} onChange={e => setActionType(e.target.value)}>
            <option value="">All Action Types</option>
            {(data?.actionTypes || []).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && !data ? (
        <SkeletonCards count={5} lines={2} />
      ) : !data || data.data.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', padding: '16px 0' }}>No matching audit log entries found.</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map(log => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{log.actor_name || 'System'}{log.actor_role ? ` (${log.actor_role})` : ''}</td>
                    <td><span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{log.action_type}</span></td>
                    <td style={{ fontSize: '13px' }}>{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={page === 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}>
              ← Prev
            </button>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Page {data.page} of {data.totalPages} ({data.total} entries)</span>
            <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={page === data.totalPages || loading} onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}>
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Shared loading skeleton — a few shimmering placeholder cards shown while
// a list is loading, instead of a bare "Loading..." line.
function SkeletonCards({ count = 3, lines = 3 }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          {Array.from({ length: lines }).map((__, j) => (
            <span key={j} className="skeleton skeleton-line" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Shared CSV download helper — same pattern the ledger report export uses.
function downloadCsv(filename, headerCols, rows) {
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = headerCols.map(escape).join(',') + '\n';
  const body = rows.map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob([header + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Full, paginated payment history across all agents/borrowers — the backend
// endpoint (/api/payments/history) already supported this with pagination,
// but nothing in the UI ever called it.
function PaymentHistoryLoader() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    api.get(`/payments/history?page=${page}&limit=25`)
      .then(res => setData(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [page]);

  const handleExportCsv = () => {
    if (!data) return;
    downloadCsv(
      `payment-history-page-${data.page}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Borrower', 'Agent', 'Type', 'Amount', 'Method', 'Notes'],
      data.data.map(tx => [
        new Date(tx.payment_date).toLocaleString(),
        tx.borrower_name,
        tx.agent_name,
        tx.payment_type,
        parseFloat(tx.amount).toFixed(2),
        tx.payment_method,
        tx.notes || ''
      ])
    );
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '24px' }}><Receipt className="icon" /> Payment History</h3>
        <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={handleExportCsv} disabled={!data || data.data.length === 0}>
          <Download className="icon" /> Export CSV (this page)
        </button>
      </div>

      {loading && !data ? (
        <SkeletonCards count={5} lines={2} />
      ) : !data || data.data.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', padding: '16px 0' }}>No payments recorded yet.</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Borrower</th>
                  <th>Agent</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(tx.payment_date).toLocaleString()}</td>
                    <td>{tx.borrower_name}</td>
                    <td>{tx.agent_name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{tx.payment_type}</td>
                    <td style={{ fontWeight: 'bold' }}>LKR {parseFloat(tx.amount).toLocaleString()}</td>
                    <td style={{ textTransform: 'capitalize' }}>{(tx.payment_method || '').replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={page === 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}>
              ← Prev
            </button>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Page {data.page} of {data.totalPages} ({data.total} payments)</span>
            <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={page === data.totalPages || loading} onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}>
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Projects what the interest balance *should* be right now, extrapolating
// forward from the loan's last stored accrual — the DB's interest_balance
// only reflects whatever the daily cron has actually run so far, which can
// lag up to a full period (e.g. 24h for a daily loan) behind what's really
// owed if the borrower is checking mid-period. Display-only: never feeds
// back into anything real, since posting actual accruals is still the
// cron's job (src/lib/services/interest.js) — this just shows the
// borrower/agent an honest "as of right now" estimate alongside it.
function projectCurrentInterestBalance(loan) {
  const stored = parseFloat(loan.interest_balance) || 0;
  if (loan.status !== 'active' || !loan.next_accrual_date) return stored;

  const principal = parseFloat(loan.principal_amount) || 0;
  const rate = parseFloat(loan.interest_rate) || 0;
  const interestPerPeriod = principal * (rate / 100);
  if (interestPerPeriod <= 0) return stored;

  const now = new Date();
  const maturity = loan.maturity_date ? new Date(loan.maturity_date) : null;
  let cursor = new Date(loan.next_accrual_date);
  let periods = 0;

  while (cursor <= now && periods < 500) {
    if (maturity && cursor > maturity) break;
    periods += 1;
    if (loan.interest_type === 'daily') cursor.setDate(cursor.getDate() + 1);
    else if (loan.interest_type === 'weekly') cursor.setDate(cursor.getDate() + 7);
    else if (loan.interest_type === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
    else break;
    cursor.setHours(0, 0, 0, 0);
  }

  return stored + periods * interestPerPeriod;
}
