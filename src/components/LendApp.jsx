'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/apiClient.js';
import { downloadLoanAgreementPdf } from '@/lib/generateLoanAgreementPdf.js';
import {
  Home, Banknote, ClipboardList, Users, Landmark, KeyRound, LogOut,
  ArrowLeft, ArrowRight, ScrollText, Check, X, Phone, IdCard, ShieldCheck,
  Printer, FileText, TrendingUp, Bell, BarChart3, Zap, AlertTriangle,
  Briefcase, Truck, BookOpen, ArrowDown, User, Settings, Ban, Receipt,
  Search, CreditCard, Smartphone, PiggyBank, MessageSquare, UserPlus, Trash2, ClipboardCheck,
  CircleCheck, CircleAlert, RefreshCcw, Download, ChevronRight, Calendar,
  Plus, ThumbsUp, ThumbsDown, Clock, Filter
} from 'lucide-react';

export default function LendApp() {
  const [token, setToken] = useState(localStorage.getItem('lend_token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('lend_user')));
  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('lend_user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed) {
            if (parsed.finance_access && !parsed.ticket_access) {
              return 'dashboard';
            }
            if (!parsed.finance_access && parsed.ticket_access) {
              return 'ticket-dashboard';
            }
            return 'portal';
          }
        } catch {
          return 'dashboard';
        }
      }
    }
    return 'dashboard';
  });
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'loans', 'agents'
  const [agentSubView, setAgentSubView] = useState('collect'); // 'collect', 'history'
  const [agentCustomerTab, setAgentCustomerTab] = useState('active'); // 'active', 'defaulted', 'closed'
  const [agentCollectMobileTab, setAgentCollectMobileTab] = useState('form'); // mobile-only: 'form', 'customers'
  const [passbookMobileTab, setPassbookMobileTab] = useState('record'); // mobile-only: 'record', 'activity', 'receipts', 'accruals'
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
  const [downloadingAgreement, setDownloadingAgreement] = useState(false);
  const [backfillDate, setBackfillDate] = useState('');

  // Admin: Cash & Tools view data (users, remittances, ledger report)
  const [adminToolsTab, setAdminToolsTab] = useState('cash'); // 'cash', 'ledger', 'users'
  const [adminUsers, setAdminUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ name: '', phone: '', email: '', role: 'agent', password: '', finance_access: true, ticket_access: true });
  const [remittances, setRemittances] = useState([]);
  const [ledgerReport, setLedgerReport] = useState(null);
  const [ledgerFrom, setLedgerFrom] = useState('');
  const [ledgerTo, setLedgerTo] = useState('');
  const [cashReconciliation, setCashReconciliation] = useState(null);

  // Ticket (Chit Fund) states
  const [ticketsList, setTicketsList] = useState([]);
  const [selectedTicketIdState, setSelectedTicketIdState] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketMembers, setTicketMembers] = useState([]);
  const [ticketAuctions, setTicketAuctions] = useState([]);
  const [ticketPayments, setTicketPayments] = useState([]);
  const [activeTicketTab, setActiveTicketTab] = useState('auction'); // 'auction', 'members', 'history'
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [newTicketForm, setNewTicketForm] = useState({ name: '', total_value: '', member_count: '', start_date: '', host_fee_type: 'percentage', host_fee_value: '' });
  const [newMemberForm, setNewMemberForm] = useState({ name: '', phone: '' });
  const [auctionForm, setAuctionForm] = useState({ bid_amount: '', winner_member_id: '', auction_date: new Date().toISOString().slice(0, 10), next_round_date: '' });
  const [ticketPaymentFilterRound, setTicketPaymentFilterRound] = useState('');

  // Agent: cash remittance submission form
  const [remittanceForm, setRemittanceForm] = useState({ amount: '', notes: '' });

  // Change password & settings modal (all roles)
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile');
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '' });
  const [settingsError, setSettingsError] = useState('');
  const [collectionSummaryMode, setCollectionSummaryMode] = useState('today'); // 'today' or 'all-time'

  // Admin: loan edit/default/penalty controls on the statement view
  const [loanEditForm, setLoanEditForm] = useState({ interest_rate: '', assigned_agent_id: '' });
  const [defaultReason, setDefaultReason] = useState('');
  const [penaltyForm, setPenaltyForm] = useState({ amount: '', reason: '' });

  // Configurable Overdue Reminder Days Threshold (default 3 days)
  const [overdueDaysThreshold, setOverdueDaysThreshold] = useState(() => {
    if (typeof window !== 'undefined') {
      return Math.max(1, parseInt(localStorage.getItem('stn_overdue_threshold_days') || '3', 10));
    }
    return 3;
  });

  const handleUpdateOverdueThreshold = (newDays) => {
    const parsed = Math.max(1, parseInt(newDays, 10) || 3);
    setOverdueDaysThreshold(parsed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('stn_overdue_threshold_days', String(parsed));
    }
    showToast(`Overdue alert threshold updated to ${parsed} days.`);
  };

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
    date_of_birth: '',
    principal_amount: '',
    interest_rate: '2.00',
    interest_type: 'daily',
    assigned_agent_id: '',
    nic_number: '',
    nic_photo: '',
    address_proof: '',
    collection_mode: 'open_ended',
    duration_periods: ''
  });
  const [includeGuarantor, setIncludeGuarantor] = useState(false);
  const emptyGuarantor = {
    full_name: '', nic_number: '', nic_photo: '', address_proof: '',
    address: '', phone: '',
    protected_under_debt_act: false, has_pending_court_cases: false,
    monthly_income_business: '', monthly_income_agriculture: '', monthly_income_other: '',
    monthly_expense_food: '', monthly_expense_rent: '', monthly_expense_other: ''
  };
  // One guarantor form per borrower dependent — the count is kept in sync
  // with borrowerProfileForm.dependents_count by an effect below (e.g.
  // dependents_count = 2 means two guarantor forms are collected).
  const [guarantorForms, setGuarantorForms] = useState([emptyGuarantor]);
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
  const [editUserForm, setEditUserForm] = useState({ name: '', phone: '', role: '', email: '', finance_access: true, ticket_access: true });

  // Borrower profile details are collected for every loan now (not
  // optional) — loan purpose, dependents, and monthly income are required;
  // spouse details stay optional since not every borrower has a spouse.
  const emptyBorrowerProfile = {
    loan_purpose: '', dependents_count: '', monthly_income: '',
    spouse_name: '', spouse_nic: '', spouse_occupation: ''
  };
  const [borrowerProfileForm, setBorrowerProfileForm] = useState(emptyBorrowerProfile);

  // Keeps the number of guarantor forms in sync with the borrower's
  // dependents count while the guarantor step is active — e.g. entering "2"
  // dependents means two guarantor forms need to be filled in. Preserves
  // whatever's already been typed into existing slots; only adds/removes
  // blank forms at the end when the count changes.
  useEffect(() => {
    if (!includeGuarantor) return;
    const desiredCount = Math.max(1, parseInt(borrowerProfileForm.dependents_count, 10) || 1);
    setGuarantorForms(prev => {
      if (prev.length === desiredCount) return prev;
      if (prev.length < desiredCount) {
        return [...prev, ...Array.from({ length: desiredCount - prev.length }, () => ({ ...emptyGuarantor }))];
      }
      return prev.slice(0, desiredCount);
    });
  }, [includeGuarantor, borrowerProfileForm.dependents_count]);

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
    if (user.ticket_access) {
      fetchTickets();
    }
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
      finance_access: targetUser.finance_access !== false,
      ticket_access: targetUser.ticket_access !== false
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
        finance_access: !!editUserForm.finance_access,
        ticket_access: !!editUserForm.ticket_access
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
        role: newUserForm.role,
        password: newUserForm.password || undefined,
        finance_access: !!newUserForm.finance_access,
        ticket_access: !!newUserForm.ticket_access
      });
      showToast(
        result.temporaryPassword
          ? `${newUserForm.name} added as ${newUserForm.role}. Temporary password: ${result.temporaryPassword}`
          : `${newUserForm.name} added as ${newUserForm.role}.`
      );
      setNewUserForm({ name: '', phone: '', email: '', role: 'agent', password: '', finance_access: true, ticket_access: true });
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
      email: user?.email || ''
    });
    setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    setSettingsError('');
    setSettingsTab('profile');
    setShowSettings(true);
  };

  // Submit profile self-updates
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSettingsError('');
    setLoading(true);
    try {
      await api.patch(`/users/${user.id}`, profileForm);
      const updatedUser = { ...user, ...profileForm };
      localStorage.setItem('lend_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      showToast('Profile updated successfully!');
      setShowSettings(false);
    } catch (err) {
      setSettingsError(err.message);
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

  // Downloads a formatted Loan Agreement PDF (with the company logo) for
  // the currently open loan statement — runs client-side via jsPDF, no
  // server round trip needed.
  const handleDownloadAgreement = async () => {
    if (!loanStatement) return;
    setDownloadingAgreement(true);
    try {
      await downloadLoanAgreementPdf(loanStatement);
    } catch (err) {
      console.error('PDF generation failed:', err);
      showToast('Could not generate the PDF. Please try again.');
    } finally {
      setDownloadingAgreement(false);
    }
  };

  // Admin: approve an agent-submitted loan application — this is the moment
  // it actually disburses.
  const handleApproveLoan = async () => {
    if (!selectedLoanId) return;
    if (!window.confirm('Approve this loan application? This disburses the cash and starts interest accruing.')) return;
    setLoading(true);
    setError('');
    try {
      await api.post(`/loans/${selectedLoanId}/approve`, {});
      showToast('Loan application approved and disbursed.');
      viewStatement(selectedLoanId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Admin: reject an agent-submitted loan application — nothing was ever
  // disbursed, so this just closes out the application.
  const handleRejectLoan = async () => {
    if (!selectedLoanId) return;
    const reason = window.prompt('Reason for rejecting this loan application:');
    if (reason === null) return; // cancelled
    if (!reason.trim()) {
      setError('A reason is required to reject a loan application.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post(`/loans/${selectedLoanId}/reject`, { reason });
      showToast('Loan application rejected.');
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
      if (data.user.finance_access && !data.user.ticket_access) {
        setView('dashboard');
      } else if (!data.user.finance_access && data.user.ticket_access) {
        setView('ticket-dashboard');
        fetchTickets();
      } else {
        setView('portal');
      }
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
    showToast('Logged out successfully.');
  };

  // --- TICKET PORTAL API CALLS ---
  const fetchTickets = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/tickets');
      setTicketsList(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetails = async (ticketId) => {
    setLoading(true);
    setError('');
    try {
      const ticket = await api.get(`/tickets/${ticketId}`);
      setSelectedTicket(ticket);
      
      const members = await api.get(`/tickets/${ticketId}/members`);
      setTicketMembers(members);

      const auctions = await api.get(`/tickets/${ticketId}/auctions`);
      setTicketAuctions(auctions);

      // Reset forms
      setNewMemberForm({ name: '', phone: '' });
      setAuctionForm({
        bid_amount: '',
        winner_member_id: '',
        auction_date: new Date().toISOString().slice(0, 10),
        next_round_date: ''
      });

      // Fetch payments for current active round (or last round)
      const targetRound = ticket.status === 'completed' 
        ? ticket.member_count 
        : Math.max(1, ticket.current_round - 1);
      
      setTicketPaymentFilterRound(String(targetRound));
      
      if (auctions.length > 0) {
        const payments = await api.get(`/tickets/${ticketId}/payments?round=${targetRound}`);
        setTicketPayments(payments);
      } else {
        setTicketPayments([]);
      }
      
      setSelectedTicketIdState(ticketId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchTicketPaymentsByRound = async (roundVal) => {
    if (!selectedTicketIdState) return;
    try {
      const payments = await api.get(`/tickets/${selectedTicketIdState}/payments?round=${roundVal}`);
      setTicketPayments(payments);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/tickets', {
        name: newTicketForm.name,
        total_value: parseFloat(newTicketForm.total_value),
        member_count: parseInt(newTicketForm.member_count, 10),
        start_date: newTicketForm.start_date,
        host_fee_type: newTicketForm.host_fee_type,
        host_fee_value: parseFloat(newTicketForm.host_fee_value)
      });
      showToast(`Ticket group '${newTicketForm.name}' created successfully.`);
      setShowCreateTicket(false);
      setNewTicketForm({ name: '', total_value: '', member_count: '', start_date: '', host_fee_type: 'percentage', host_fee_value: '' });
      fetchTickets();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTicketMember = async (e) => {
    e.preventDefault();
    if (!selectedTicketIdState) return;
    setLoading(true);
    setError('');
    try {
      const member = await api.post(`/tickets/${selectedTicketIdState}/members`, {
        name: newMemberForm.name,
        phone: newMemberForm.phone
      });
      showToast(`Member '${newMemberForm.name}' added successfully.`);
      setNewMemberForm({ name: '', phone: '' });
      // Refresh details
      fetchTicketDetails(selectedTicketIdState);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunTicketAuction = async (e) => {
    e.preventDefault();
    if (!selectedTicketIdState) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.post(`/tickets/${selectedTicketIdState}/auctions`, {
        bid_amount: parseFloat(auctionForm.bid_amount),
        winner_member_id: auctionForm.winner_member_id || undefined,
        auction_date: auctionForm.auction_date,
        next_round_date: auctionForm.next_round_date || undefined
      });
      showToast(`Successfully recorded auction for round ${result.round_number}.`);
      // Refresh details
      fetchTicketDetails(selectedTicketIdState);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTicketPayment = async (paymentId, isPaid) => {
    if (!selectedTicketIdState) return;
    try {
      const res = await api.put(`/tickets/${selectedTicketIdState}/payments`, {
        payment_id: paymentId,
        is_paid: isPaid
      });
      showToast(`Payment status updated.`);
      // Refresh payments list without full detail reload
      handleFetchTicketPaymentsByRound(ticketPaymentFilterRound);
    } catch (err) {
      setError(err.message);
    }
  };

  const isValidNIC = (nic) => {
    if (!nic) return false;
    const cleaned = nic.trim().toUpperCase();
    return /^[0-9]{9}[VX]$/.test(cleaned) || /^[0-9]{12}$/.test(cleaned);
  };

  const handleShareWhatsAppReceipt = (receipt) => {
    if (!receipt) return;
    const cleanPhone = (receipt.borrower_phone || '').replace(/[^0-9]/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? '94' + cleanPhone.slice(1) : (cleanPhone.startsWith('94') ? cleanPhone : '94' + cleanPhone);
    const text = `*STN MICRO CREDIT (PVT) LTD — OFFICIAL PAYMENT RECEIPT*\n\n` +
      `🧾 *Receipt ID:* ${receipt.id}\n` +
      `📅 *Date:* ${new Date(receipt.payment_date).toLocaleString()}\n` +
      `👤 *Borrower:* ${receipt.borrower_name}\n` +
      `💰 *Amount Collected:* LKR ${parseFloat(receipt.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
      `📝 *Payment Type:* ${receipt.payment_type === 'principal' ? 'Principal Repayment' : 'Interest Payment'}\n` +
      (receipt.loan_principal_outstanding ? `💳 *Remaining Principal:* LKR ${parseFloat(receipt.loan_principal_outstanding).toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` : '') +
      (receipt.loan_interest_balance ? `💸 *Interest Due:* LKR ${parseFloat(receipt.loan_interest_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` : '') +
      `🤝 *Recorded By:* ${receipt.agent_name || 'Branch Office'}\n\n` +
      `_Thank you for your timely payment!_`;
    const url = `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const runKYCValidation = () => {
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
      errors.nic_number = "A valid Sri Lankan NIC number is required (9 digits + V/X, or 12 digits).";
      if (!firstErrorField) firstErrorField = "nic_number";
    }
    if (!newLoan.date_of_birth) {
      errors.date_of_birth = "Borrower's date of birth is required.";
      if (!firstErrorField) firstErrorField = "date_of_birth";
    }
    if (!newLoan.address_proof) {
      errors.address_proof = "Borrower's address proof photo is required.";
      if (!firstErrorField) firstErrorField = "address_proof";
    }

    setValidationErrors(prev => ({ ...prev, ...errors }));

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

  const runFinancialValidation = () => {
    const errors = {};
    let firstErrorField = null;

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

    setValidationErrors(prev => ({ ...prev, ...errors }));

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

  const runTermsValidation = () => {
    const errors = {};
    let firstErrorField = null;

    if (!newLoan.principal_amount || parseFloat(newLoan.principal_amount) <= 0) {
      errors.principal_amount = "Principal amount must be a positive number.";
      if (!firstErrorField) firstErrorField = "principal_amount";
    }
    if (!newLoan.interest_rate || parseFloat(newLoan.interest_rate) < 0) {
      errors.interest_rate = "Interest rate must be a non-negative number.";
      if (!firstErrorField) firstErrorField = "interest_rate";
    }
    if (newLoan.collection_mode === 'fixed_term' && (!newLoan.duration_periods || parseInt(newLoan.duration_periods, 10) <= 0)) {
      errors.duration_periods = "Duration period is required for fixed term loans.";
      if (!firstErrorField) firstErrorField = "duration_periods";
    } else if (newLoan.interest_type === 'daily' && newLoan.collection_mode === 'fixed_term' && parseInt(newLoan.duration_periods, 10) % 31 !== 0) {
      errors.duration_periods = "Daily Fixed Term duration must be 31, 62, 93, etc. (a multiple of 31 — one extra collection day per month).";
      if (!firstErrorField) firstErrorField = "duration_periods";
    }

    setValidationErrors(prev => ({ ...prev, ...errors }));

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

  const runGuarantorValidation = () => {
    const errors = {};
    let firstErrorField = null;

    guarantorForms.forEach((g, i) => {
      if (!g.full_name || !g.full_name.trim()) {
        errors[`guarantor_${i}_full_name`] = "Guarantor full name is required.";
        if (!firstErrorField) firstErrorField = `guarantor_${i}_full_name`;
      }
      if (!g.nic_number || !isValidNIC(g.nic_number)) {
        errors[`guarantor_${i}_nic_number`] = "A valid Sri Lankan NIC number is required for the guarantor.";
        if (!firstErrorField) firstErrorField = `guarantor_${i}_nic_number`;
      }
      if (!g.nic_photo) {
        errors[`guarantor_${i}_nic_photo`] = "A NIC photo is required for the guarantor.";
        if (!firstErrorField) firstErrorField = `guarantor_${i}_nic_photo`;
      }
      if (!g.address_proof) {
        errors[`guarantor_${i}_address_proof`] = "An address proof photo is required for the guarantor.";
        if (!firstErrorField) firstErrorField = `guarantor_${i}_address_proof`;
      }
      if (!g.phone || !g.phone.trim()) {
        errors[`guarantor_${i}_phone`] = "Guarantor phone number is required.";
        if (!firstErrorField) firstErrorField = `guarantor_${i}_phone`;
      }
      if (!g.address || !g.address.trim()) {
        errors[`guarantor_${i}_address`] = "Guarantor address is required.";
        if (!firstErrorField) firstErrorField = `guarantor_${i}_address`;
      }
    });

    setValidationErrors(prev => ({ ...prev, ...errors }));

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

  const handleWizardNext = (currentStep) => {
    setError('');
    if (currentStep === 1) {
      if (runKYCValidation()) setGiveLoanStep(2);
    } else if (currentStep === 2) {
      if (runFinancialValidation()) setGiveLoanStep(3);
    } else if (currentStep === 3) {
      if (runTermsValidation()) {
        if (includeGuarantor) {
          setGiveLoanStep(4);
        } else {
          handleCreateLoan();
        }
      }
    } else if (currentStep === 4) {
      if (runGuarantorValidation()) {
        handleCreateLoan();
      }
    }
  };

  const handleWizardBack = (currentStep) => {
    setError('');
    setGiveLoanStep(Math.max(1, currentStep - 1));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleWizardNext(giveLoanStep);
  };

  // Admin: Create new loan
  const handleCreateLoan = async (e) => {
    if (e) e.preventDefault();
    setError('');
    
    if (!runKYCValidation()) {
      setGiveLoanStep(1);
      return;
    }
    if (!runFinancialValidation()) {
      setGiveLoanStep(2);
      return;
    }
    if (!runTermsValidation()) {
      setGiveLoanStep(3);
      return;
    }
    if (includeGuarantor && !runGuarantorValidation()) {
      setGiveLoanStep(4);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = {
        ...newLoan,
        borrower_date_of_birth: newLoan.date_of_birth,
        guarantors: includeGuarantor ? guarantorForms : [],
        borrower_profile: borrowerProfileForm
      };
      await api.post('/loans', payload);
      showToast(
        user.role === 'agent'
          ? `Loan application for ${newLoan.borrower_name} submitted — awaiting admin approval.`
          : `Loan disbursed to ${newLoan.borrower_name} successfully! Notification sent.`
      );
      setNewLoan({
        borrower_name: '',
        borrower_phone: '',
        borrower_address: '',
        borrower_email: '',
        borrower_gender: '',
        date_of_birth: '',
        principal_amount: '',
        interest_rate: '2.00',
        interest_type: 'daily',
        assigned_agent_id: '',
        nic_number: '',
        nic_photo: '',
        address_proof: '',
        collection_mode: 'open_ended',
        duration_periods: ''
      });
      setGiveLoanStep(1);
      setIncludeGuarantor(false);
      setGuarantorForms([emptyGuarantor]);
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
    const isFlatInstallmentLoan = !!loanStatement.loan.is_flat_installment;
    try {
      const response = await api.post('/payments', {
        loan_id: loanId,
        payment_type: isFlatInstallmentLoan ? 'flat_installment' : ledgerPaymentForm.payment_type,
        amount: parseFloat(ledgerPaymentForm.amount),
        notes: ledgerPaymentForm.notes,
        proof_image_url: ledgerPaymentForm.proof_image || null,
        payment_method: ledgerPaymentForm.payment_method,
        idempotency_key: ledgerPaymentForm.idempotency_key || (Math.random().toString(36).substring(2) + Date.now())
      });

      const kind = isFlatInstallmentLoan ? 'Daily installment' : (ledgerPaymentForm.payment_type === 'interest' ? 'Interest' : 'Principal');
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

  // File to base64 converter for borrower address proof photo
  const handleAddressProofChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewLoan(prev => ({ ...prev, address_proof: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Updates one field on one guarantor form in the guarantorForms array.
  const updateGuarantorField = (index, field, value) => {
    setGuarantorForms(prev => prev.map((g, i) => (i === index ? { ...g, [field]: value } : g)));
  };

  // File to base64 converter for a guarantor's NIC photo (one per guarantor
  // form, indexed since there can be more than one guarantor).
  const handleGuarantorPhotoChange = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateGuarantorField(index, 'nic_photo', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // File to base64 converter for a guarantor's address proof photo
  const handleGuarantorAddressProofChange = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateGuarantorField(index, 'address_proof', reader.result);
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
              <div className="receipt-title">STN MICRO CREDIT</div>
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
            <img src="/stn_logo.png" alt="STN Micro Credit Logo" style={{ height: '44px', width: 'auto', marginBottom: '6px' }} />
            <div className="print-title">STN MICRO CREDIT COMPANY (PVT) LTD</div>
            <div style={{ fontSize: '9pt', color: '#555555', fontWeight: 'bold' }}>Official Payment Receipt</div>
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

            {(loanStatement.guarantors || []).length > 0 && (
              <>
                <h4 style={{ fontSize: '15px', margin: '16px 0 6px' }}>4. Guarantor{loanStatement.guarantors.length > 1 ? 's' : ''}</h4>
                {loanStatement.guarantors.map((gtor, gi) => (
                  <p style={{ fontSize: '14px' }} key={gtor.id || gi}>
                    <strong>{gtor.full_name}</strong> (NIC: {gtor.nic_number}), residing at {gtor.address},
                    stands as guarantor for this loan and accepts joint responsibility for repayment in the event the Borrower defaults.
                  </p>
                ))}
              </>
            )}

            <h4 style={{ fontSize: '15px', margin: '16px 0 6px' }}>{(loanStatement.guarantors || []).length > 0 ? '5' : loanStatement.loan.loan_purpose ? '4' : '3'}. Default</h4>
            <p style={{ fontSize: '14px' }}>If the Borrower fails to pay interest or repay the principal as agreed, the Lender has the right to take legal action to recover the outstanding amount.</p>

            <h4 style={{ fontSize: '15px', margin: '16px 0 6px' }}>{(loanStatement.guarantors || []).length > 0 ? '6' : loanStatement.loan.loan_purpose ? '5' : '4'}. Declaration</h4>
            <p style={{ fontSize: '14px' }}>Both parties confirm they have read, understood, and agree to all the terms stated above.</p>

            <div className="receipt-actions">
              <button type="button" className="glass-btn glass-btn-secondary" onClick={() => setShowLoanAgreement(false)}>
                Close
              </button>
              <button type="button" className="glass-btn glass-btn-secondary" onClick={() => window.print()}>
                <Printer className="icon" /> Print
              </button>
              <button type="button" className="glass-btn glass-btn-emerald" onClick={handleDownloadAgreement} disabled={downloadingAgreement}>
                <Download className="icon" /> {downloadingAgreement ? 'Generating...' : 'Download PDF'}
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

          {(loanStatement.guarantors || []).length > 0 && (
            <>
              <h2>{loanStatement.loan.loan_purpose ? '4' : '3'}. Guarantor{loanStatement.guarantors.length > 1 ? 's' : ''}</h2>
              {loanStatement.guarantors.map((gtor, gi) => (
                <p key={gtor.id || gi}>
                  <strong>{gtor.full_name}</strong> (NIC: {gtor.nic_number}), residing at {gtor.address},
                  stands as guarantor for this loan and accepts joint responsibility for repayment in the event the Borrower defaults.
                </p>
              ))}
            </>
          )}

          <h2>{(loanStatement.guarantors || []).length > 0 ? '5' : loanStatement.loan.loan_purpose ? '4' : '3'}. Default</h2>
          <p>If the Borrower fails to pay interest or repay the principal as agreed, the Lender has the right to take legal action to recover the outstanding amount.</p>

          <h2>{(loanStatement.guarantors || []).length > 0 ? '6' : loanStatement.loan.loan_purpose ? '5' : '4'}. Declaration</h2>
          <p>Both parties confirm they have read, understood, and agree to all the terms stated above.</p>

          <div className="agreement-signature-block">
            <div className="agreement-signature-line">Lender</div>
            <div className="agreement-signature-line">Borrower ({loanStatement.loan.borrower_name})</div>
            {(loanStatement.guarantors || []).map((gtor, gi) => (
              <div className="agreement-signature-line" key={gtor.id || gi}>Guarantor ({gtor.full_name})</div>
            ))}
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
            <h1 style={{ fontSize: '22px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src="/stn_emblem.png?v=2" alt="STN Micro Credit Logo" style={{ height: '42px', width: 'auto', objectFit: 'contain' }} />
              <span style={{ fontWeight: '800', letterSpacing: '0.5px' }}>STN MICRO CREDIT</span>
            </h1>
            <span className="badge badge-active">{user.role}</span>
          </div>

          {/* Desktop Navigation Links */}
          {user.role === 'admin' && view !== 'portal' && view !== 'ticket-dashboard' && (
            <div className="desktop-header-nav">
              <button className={`nav-link-btn ${view === 'dashboard' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setSelectedLoanId(null); setLoanStatement(null); }}><Home className="icon" /> Home</button>
              <button className={`nav-link-btn ${view === 'create-loan' ? 'active' : ''}`} onClick={() => { setView('create-loan'); setSelectedLoanId(null); setLoanStatement(null); }}><Banknote className="icon" /> Give Loan</button>
              <button className={`nav-link-btn ${view === 'next-day-tasklist' ? 'active' : ''}`} onClick={() => { setView('next-day-tasklist'); setSelectedLoanId(null); setLoanStatement(null); }}><Calendar className="icon" /> Next Day Tasklist</button>
              <button className={`nav-link-btn ${view === 'record-payment' ? 'active' : ''}`} onClick={() => { setView('record-payment'); setSelectedLoanId(null); setLoanStatement(null); }}><CreditCard className="icon" /> Record Payment</button>
              <button className={`nav-link-btn ${view === 'loans' ? 'active' : ''}`} onClick={() => { setView('loans'); setSelectedLoanId(null); setLoanStatement(null); }}><ClipboardList className="icon" /> Check Loans</button>
              <button className={`nav-link-btn ${view === 'agents' ? 'active' : ''}`} onClick={() => { setView('agents'); setSelectedLoanId(null); setLoanStatement(null); }}><Users className="icon" /> Agent Route</button>
              <button className={`nav-link-btn ${view === 'admin-tools' ? 'active' : ''}`} onClick={openAdminTools}><Landmark className="icon" /> Users & Cash Tools</button>
              <button className={`nav-link-btn ${view === 'interest-center' ? 'active' : ''}`} onClick={() => { setView('interest-center'); setSelectedLoanId(null); setLoanStatement(null); }}><TrendingUp className="icon" /> Interest Center</button>
              <button className={`nav-link-btn ${view === 'payment-history' ? 'active' : ''}`} onClick={() => { setView('payment-history'); setSelectedLoanId(null); setLoanStatement(null); }}><Receipt className="icon" /> Payment History</button>
              <button className={`nav-link-btn ${view === 'audit-log' ? 'active' : ''}`} onClick={() => { setView('audit-log'); setSelectedLoanId(null); setLoanStatement(null); }}><ScrollText className="icon" /> Audit Log</button>
              {user.finance_access !== false && user.ticket_access !== false && (
                <button className="nav-link-btn" onClick={() => { setView('portal'); setSelectedLoanId(null); setLoanStatement(null); }} style={{ background: 'rgba(37, 84, 232, 0.1)', color: 'var(--accent-blue)', fontWeight: 'bold' }}>
                  Switch Portal &rarr;
                </button>
              )}
            </div>
          )}
          {user.role === 'agent' && view !== 'portal' && view !== 'ticket-dashboard' && (
            <div className="desktop-header-nav">
              <button className={`nav-link-btn ${view === 'create-loan' ? 'active' : ''}`} onClick={() => { setView('create-loan'); setGiveLoanStep(1); }}><Banknote className="icon" /> Give Loan</button>
              <button className={`nav-link-btn ${view === 'dashboard' && agentSubView === 'collect' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setAgentSubView('collect'); }}><CreditCard className="icon" /> Collect Payments</button>
              <button className={`nav-link-btn ${view === 'dashboard' && agentSubView === 'next-day-tasklist' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setAgentSubView('next-day-tasklist'); }}><Calendar className="icon" /> Next Day Tasklist</button>
              <button className={`nav-link-btn ${view === 'dashboard' && agentSubView === 'record-payment' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setAgentSubView('record-payment'); }}><CreditCard className="icon" /> Record Payment</button>
              <button className={`nav-link-btn ${view === 'dashboard' && agentSubView === 'history' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setAgentSubView('history'); }}><ScrollText className="icon" /> Collection History</button>
              <button className={`nav-link-btn ${view === 'dashboard' && agentSubView === 'remit' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setAgentSubView('remit'); }}><Landmark className="icon" /> Remit Cash</button>
              {user.finance_access !== false && user.ticket_access !== false && (
                <button className="nav-link-btn" onClick={() => { setView('portal'); setSelectedLoanId(null); setLoanStatement(null); }} style={{ background: 'rgba(37, 84, 232, 0.1)', color: 'var(--accent-blue)', fontWeight: 'bold' }}>
                  Switch Portal &rarr;
                </button>
              )}
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
            {user.finance_access !== false && user.ticket_access !== false && view !== 'portal' && (
              <button className="glass-btn glass-btn-secondary" style={{ padding: '10px 16px', fontSize: '14px', border: '1px solid rgba(59,130,246,0.3)' }} onClick={() => { setView('portal'); setSelectedLoanId(null); setLoanStatement(null); setSelectedTicket(null); setSelectedTicketIdState(null); }}>
                <ArrowLeft className="icon" style={{ color: 'var(--accent-blue)' }} /> <span className="btn-label-text">Switch Portal</span>
              </button>
            )}
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

            {settingsError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent-rose)', color: 'var(--accent-rose)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' }}>
                {settingsError}
              </div>
            )}

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
                setSettingsError('');
                if (passwordForm.new_password !== passwordForm.confirm_password) {
                  setSettingsError('New password and confirmation do not match.');
                  return;
                }
                setLoading(true);
                try {
                  await api.post('/auth/change-password', {
                    current_password: passwordForm.current_password,
                    new_password: passwordForm.new_password
                  });
                  showToast('Password changed successfully.');
                  setShowSettings(false);
                  setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
                } catch (err) {
                  setSettingsError(err.message);
                } finally {
                  setLoading(false);
                }
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
            <div className="glass-card" style={{ width: '100%', maxWidth: '420px', padding: '32px 28px' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <img src="/stn_logo.png" alt="STN Micro Credit Logo" style={{ width: '140px', height: 'auto', margin: '0 auto 12px auto', display: 'block', borderRadius: '8px' }} />
                <h2 style={{ fontSize: '26px', margin: '0 0 4px 0', fontWeight: '800', color: 'var(--text-primary)' }}>STN MICRO CREDIT</h2>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block' }}>Company (Pvt) Ltd</span>
              </div>

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

        {/* ----------------- PORTAL SELECTOR ----------------- */}
        {token && user && view === 'portal' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '65vh', gap: '28px', padding: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '8px' }}>STN UNIFIED PLATFORM</span>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Welcome, {user.name}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>Select a service portal below to proceed</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', width: '100%', maxWidth: '780px' }}>
              {user.finance_access !== false && (
                <div className="portal-card portal-card-blue" onClick={() => { setView('dashboard'); showToast('Entering Credit/Finance System'); }} style={{ cursor: 'pointer' }}>
                  <div className="portal-card-header">
                    <div className="portal-card-icon"><Landmark style={{ width: '28px', height: '28px' }} /></div>
                    <span className="portal-card-badge">Finance Portal</span>
                  </div>
                  <h3 className="portal-card-title">Credit & Loans</h3>
                  <p className="portal-card-desc">Manage cash disbursements, active loan files, daily agent collections, interest calculations, and double-entry accounting ledger reports.</p>
                  <div className="portal-card-action">Enter System &rarr;</div>
                </div>
              )}

              {user.ticket_access !== false && (
                <div className="portal-card portal-card-emerald" onClick={() => { setView('ticket-dashboard'); fetchTickets(); showToast('Entering Chit Fund/Ticket System'); }} style={{ cursor: 'pointer' }}>
                  <div className="portal-card-header">
                    <div className="portal-card-icon"><PiggyBank style={{ width: '28px', height: '28px' }} /></div>
                    <span className="portal-card-badge">Ticket Portal</span>
                  </div>
                  <h3 className="portal-card-title">Chit Fund Ledger</h3>
                  <p className="portal-card-desc">Create and run chit groups, calculate discounts/auctions, manage member registers, track payments per round, and generate Tamil WhatsApp notices.</p>
                  <div className="portal-card-action">Enter System &rarr;</div>
                </div>
              )}
            </div>

            <button className="glass-btn glass-btn-secondary" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', borderRadius: '12px', marginTop: '10px' }} onClick={handleLogout}>
              <LogOut style={{ width: '16px', height: '16px' }} /> Logout of Account
            </button>
          </div>
        )}

        {/* ----------------- TICKET PORTAL VIEWS ----------------- */}
        {token && user && view === 'ticket-dashboard' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Header / Group Selector list */}
            {!selectedTicket ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {user.finance_access !== false && user.ticket_access !== false && (
                      <button className="glass-btn glass-btn-secondary" style={{ padding: '8px 14px' }} onClick={() => setView('portal')}>
                        <ArrowLeft className="icon" /> Main Selector
                      </button>
                    )}
                    <div>
                      <h2 style={{ fontSize: '28px', margin: 0 }}>Ticket Groups Dashboard</h2>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Host-focused Chit Fund Management</span>
                    </div>
                  </div>
                  {user.role === 'admin' && (
                    <button className="glass-btn glass-btn-emerald" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setShowCreateTicket(true)}>
                      <Plus style={{ width: '16px', height: '16px' }} /> Create New Group
                    </button>
                  )}
                </div>

                {/* Create Ticket Group Modal */}
                {showCreateTicket && (
                  <div className="receipt-modal-overlay" onClick={() => setShowCreateTicket(false)}>
                    <div className="glass-card" style={{ maxWidth: '540px', width: '90%', padding: '24px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><PiggyBank className="icon" /> Create New Chit Group</h3>
                        <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setShowCreateTicket(false)}>Close</button>
                      </div>
                      <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>TICKET GROUP NAME *</label>
                          <input required type="text" className="glass-input" placeholder="e.g. STN Aug 300k Group" value={newTicketForm.name} onChange={e => setNewTicketForm(prev => ({ ...prev, name: e.target.value }))} />
                        </div>
                        <div className="form-grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>TOTAL VALUE (LKR) *</label>
                            <input required type="number" inputMode="decimal" min="1" className="glass-input" placeholder="e.g. 300000" value={newTicketForm.total_value} onChange={e => setNewTicketForm(prev => ({ ...prev, total_value: e.target.value }))} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>MEMBER COUNT *</label>
                            <input required type="number" inputMode="numeric" min="2" className="glass-input" placeholder="e.g. 20" value={newTicketForm.member_count} onChange={e => setNewTicketForm(prev => ({ ...prev, member_count: e.target.value }))} />
                          </div>
                        </div>
                        <div className="form-grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>START DATE *</label>
                            <input required type="date" className="glass-input" value={newTicketForm.start_date} onChange={e => setNewTicketForm(prev => ({ ...prev, start_date: e.target.value }))} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>HOST FEE CALCULATION *</label>
                            <select className="glass-input" value={newTicketForm.host_fee_type} onChange={e => setNewTicketForm(prev => ({ ...prev, host_fee_type: e.target.value, host_fee_value: '' }))}>
                              <option value="percentage">Percentage (on original share)</option>
                              <option value="fixed">Fixed Fee (per member)</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>
                            {newTicketForm.host_fee_type === 'percentage' ? 'HOST FEE PERCENTAGE (%) *' : 'FIXED FEE AMOUNT PER MEMBER (LKR) *'}
                          </label>
                          <input required type="number" inputMode="decimal" step="0.01" min="0" className="glass-input" placeholder={newTicketForm.host_fee_type === 'percentage' ? 'e.g. 5.00' : 'e.g. 500'} value={newTicketForm.host_fee_value} onChange={e => setNewTicketForm(prev => ({ ...prev, host_fee_value: e.target.value }))} />
                        </div>
                        
                        {/* Auto calculations display */}
                        {parseFloat(newTicketForm.total_value) > 0 && parseInt(newTicketForm.member_count, 10) > 0 && (
                          <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '14px', fontSize: '13px' }}>
                            {(() => {
                              const val = parseFloat(newTicketForm.total_value);
                              const count = parseInt(newTicketForm.member_count, 10);
                              const share = val / count;
                              let fee = 0;
                              if (newTicketForm.host_fee_type === 'percentage') {
                                fee = share * ((parseFloat(newTicketForm.host_fee_value) || 0) / 100);
                              } else {
                                fee = parseFloat(newTicketForm.host_fee_value) || 0;
                              }
                              return (
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Original Share per Member:</span>
                                    <strong style={{ color: 'var(--accent-blue)' }}>LKR {share.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Host Fee collected per Member:</span>
                                    <strong>LKR {fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        <button type="submit" className="glass-btn glass-btn-emerald" disabled={loading} style={{ width: '100%', padding: '12px', marginTop: '10px' }}>
                          Create Ticket Group
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* Groups Grid */}
                {ticketsList.length === 0 ? (
                  <div className="glass-card">
                    <div className="empty-state">
                      <div className="empty-state-icon"><PiggyBank style={{ width: '28px', height: '28px' }} /></div>
                      <h4 className="empty-state-title">No Ticket Groups Registered</h4>
                      <p className="empty-state-text">There are no Chit Fund groups created yet. Click "Create New Group" to initialize a ticket group schema.</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                    {ticketsList.map(t => {
                      const totalVal = parseFloat(t.total_value);
                      const originalShare = totalVal / t.member_count;
                      return (
                        <div key={t.id} className="glass-card" style={{ cursor: 'pointer', transition: 'transform 0.2s', padding: '24px', position: 'relative' }} onClick={() => fetchTicketDetails(t.id)}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                            <h3 style={{ fontSize: '18px', margin: 0, fontWeight: 'bold' }}>{t.name}</h3>
                            <span className={`status-pill ${t.status === 'active' ? 'status-pill-active' : 'status-pill-paid'}`}>
                              <span className="status-pill-dot" />{t.status === 'active' ? 'Active' : 'Completed'}
                            </span>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Total Ticket Value</span>
                              <span style={{ fontSize: '14px', fontWeight: '700' }}>LKR {totalVal.toLocaleString()}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Member Count</span>
                              <span style={{ fontSize: '14px', fontWeight: '700' }}>{t.member_count} Members</span>
                            </div>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Original Share</span>
                              <span style={{ fontSize: '14px', fontWeight: '700' }}>LKR {originalShare.toLocaleString()}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Host Fee Rules</span>
                              <span style={{ fontSize: '13px', fontWeight: '600' }}>
                                {t.host_fee_type === 'percentage' ? `${t.host_fee_value}% Share` : `LKR ${parseFloat(t.host_fee_value).toLocaleString()} Fixed`}
                              </span>
                            </div>
                          </div>

                          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <span>Start: <strong>{new Date(t.start_date).toLocaleDateString()}</strong></span>
                            <span>Round: <strong style={{ color: 'var(--accent-blue)' }}>{t.status === 'completed' ? 'All Completed' : `${t.current_round} of ${t.member_count}`}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* Single Group Detail View */
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                  <button className="glass-btn glass-btn-secondary" style={{ padding: '8px 14px' }} onClick={() => { setSelectedTicketIdState(null); setSelectedTicket(null); fetchTickets(); }}>
                    <ArrowLeft className="icon" /> Back to Groups List
                  </button>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span className="badge badge-active" style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)', padding: '6px 12px' }}>Total LKR {parseFloat(selectedTicket.total_value).toLocaleString()}</span>
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '24px' }}>
                  <h2 style={{ fontSize: '26px', margin: '0 0 6px 0' }}>{selectedTicket.name}</h2>
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <span>Members: <strong>{ticketMembers.length} / {selectedTicket.member_count}</strong></span>
                    <span>•</span>
                    <span>Start: <strong>{new Date(selectedTicket.start_date).toLocaleDateString()}</strong></span>
                    <span>•</span>
                    <span>Current Round: <strong style={{ color: 'var(--accent-blue)' }}>{selectedTicket.status === 'completed' ? 'Completed' : selectedTicket.current_round}</strong></span>
                    {selectedTicket.next_round_date && (
                      <>
                        <span>•</span>
                        <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>Next Round Date: {new Date(selectedTicket.next_round_date).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Sub Tab Bar Selector */}
                <div className="subtab-pill-bar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                  <button type="button" className={`glass-btn ${activeTicketTab === 'auction' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`} style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => setActiveTicketTab('auction')}>
                    <TrendingUp style={{ width: '14px', height: '14px', marginRight: '4px' }} /> Round Auction & Notice
                  </button>
                  <button type="button" className={`glass-btn ${activeTicketTab === 'members' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`} style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => setActiveTicketTab('members')}>
                    <Users style={{ width: '14px', height: '14px', marginRight: '4px' }} /> Member Roster ({ticketMembers.length})
                  </button>
                  <button type="button" className={`glass-btn ${activeTicketTab === 'payments' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`} style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => setActiveTicketTab('payments')}>
                    <CreditCard style={{ width: '14px', height: '14px', marginRight: '4px' }} /> Payments Tracker
                  </button>
                  <button type="button" className={`glass-btn ${activeTicketTab === 'history' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`} style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => setActiveTicketTab('history')}>
                    <ScrollText style={{ width: '14px', height: '14px', marginRight: '4px' }} /> Past Auctions History ({ticketAuctions.length})
                  </button>
                </div>

                {/* Tab content renders */}
                {activeTicketTab === 'auction' && (
                  <div className="responsive-grid-2-col animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                    {/* Run Auction panel */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                      <h3 style={{ fontSize: '18px', marginBottom: '14px', fontWeight: 'bold' }}><TrendingUp className="icon" /> Run Round {selectedTicket.current_round} Auction</h3>
                      
                      {selectedTicket.status === 'completed' ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>This ticket group has completed all of its rounds.</p>
                      ) : (
                        <form onSubmit={handleRunTicketAuction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>BID AMOUNT (கழிவு / DISCOUNT) *</label>
                            <input required type="number" inputMode="decimal" min="0" max={parseFloat(selectedTicket.total_value)} className="glass-input" placeholder="e.g. 130000" value={auctionForm.bid_amount} onChange={e => setAuctionForm(prev => ({ ...prev, bid_amount: e.target.value }))} />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>ROUND WINNER</label>
                            <select className="glass-input" value={auctionForm.winner_member_id} onChange={e => setAuctionForm(prev => ({ ...prev, winner_member_id: e.target.value }))}>
                              <option value="">-- No Winner Selected Yet --</option>
                              {ticketMembers.filter(m => !ticketAuctions.some(a => a.winner_member_id === m.id)).map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>Only shows members who haven't already won a previous round.</span>
                          </div>

                          <div className="form-grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>AUCTION DATE *</label>
                              <input required type="date" className="glass-input" value={auctionForm.auction_date} onChange={e => setAuctionForm(prev => ({ ...prev, auction_date: e.target.value }))} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>NEXT ROUND DATE *</label>
                              <input required type="date" className="glass-input" value={auctionForm.next_round_date} onChange={e => setAuctionForm(prev => ({ ...prev, next_round_date: e.target.value }))} />
                            </div>
                          </div>

                          {/* calculations preview */}
                          {parseFloat(auctionForm.bid_amount) >= 0 && (
                            <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '14px', fontSize: '13px' }}>
                              {(() => {
                                const totalVal = parseFloat(selectedTicket.total_value);
                                const bidVal = parseFloat(auctionForm.bid_amount) || 0;
                                const count = selectedTicket.member_count;
                                const payout = totalVal - bidVal;
                                const base = payout / count;
                                let fee = 0;
                                if (selectedTicket.host_fee_type === 'percentage') {
                                  fee = (totalVal / count) * ((parseFloat(selectedTicket.host_fee_value) || 0) / 100);
                                } else {
                                  fee = parseFloat(selectedTicket.host_fee_value) || 0;
                                }
                                const finalAmount = base + fee;
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: 'var(--text-secondary)' }}>Winner Payout:</span>
                                      <strong style={{ color: 'var(--accent-emerald)' }}>LKR {payout.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: 'var(--text-secondary)' }}>Base Payment per person:</span>
                                      <strong>LKR {base.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: 'var(--text-secondary)' }}>Host Fee per person:</span>
                                      <strong>LKR {fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-light)', paddingTop: '4px', marginTop: '4px' }}>
                                      <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Repayment per member:</span>
                                      <strong style={{ color: 'var(--accent-blue)', fontSize: '14px' }}>LKR {finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {user.role === 'admin' ? (
                            <button type="submit" className="glass-btn glass-btn-emerald" disabled={loading} style={{ width: '100%', padding: '12px' }}>
                              Submit Auction Round
                            </button>
                          ) : (
                            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--accent-rose)', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center' }}>
                              Only Admin hosts can submit auction rounds.
                            </div>
                          )}
                        </form>
                      )}
                    </div>

                    {/* WhatsApp Notice Panel */}
                    <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}><MessageSquare className="icon" style={{ color: '#25D366' }} /> Tamil WhatsApp Notice</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px', marginBottom: 0 }}>Forward notice text directly to your WhatsApp group.</p>
                      </div>

                      {/* 1. Last Completed Round Notice */}
                      {ticketAuctions.length > 0 && (() => {
                        const lastAuction = ticketAuctions[ticketAuctions.length - 1];
                        const totalVal = parseFloat(selectedTicket.total_value);
                        const bidVal = parseFloat(lastAuction.bid_amount);
                        const payout = parseFloat(lastAuction.winner_payout);
                        const finalAmount = parseFloat(lastAuction.amount_per_member);
                        const roundNum = lastAuction.round_number;
                        const nextDateStr = selectedTicket.next_round_date 
                          ? new Date(selectedTicket.next_round_date).toLocaleDateString()
                          : '____________';

                        const noticeText = `ரூ ${totalVal.toLocaleString()}\n` +
                          `${roundNum}ம் சீட்டு கழிவு ரூ ${bidVal.toLocaleString()}\n` +
                          `💵 கிடைக்கும் தொகை:\n` +
                          `ரூ ${payout.toLocaleString()}\n` +
                          `💳 கட்டு காசு:\n` +
                          `ரூ ${finalAmount.toLocaleString()}\n` +
                          `📅 ${roundNum + 1}ம் சீட்டு திகதி:\n` +
                          `${nextDateStr}`;

                        return (
                          <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent-emerald)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>📢 Last Completed Round {roundNum} Notice</span>
                            <div style={{ background: '#075e54', color: 'white', borderRadius: '8px', padding: '12px', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap', border: '1px solid #128c7e', marginBottom: '10px' }}>
                              {noticeText}
                            </div>
                            <button
                              type="button"
                              className="glass-btn"
                              style={{ width: '100%', padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', backgroundColor: '#25D366', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '12px' }}
                              onClick={() => {
                                const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(noticeText)}`;
                                window.open(url, '_blank');
                              }}
                            >
                              <MessageSquare style={{ width: '14px', height: '14px' }} /> Share Round {roundNum} Notice to WhatsApp
                            </button>
                          </div>
                        );
                      })()}

                      {/* 2. Upcoming Round Draft Notice */}
                      {parseFloat(auctionForm.bid_amount) >= 0 && (() => {
                        const totalVal = parseFloat(selectedTicket.total_value);
                        const bidVal = parseFloat(auctionForm.bid_amount) || 0;
                        const count = selectedTicket.member_count;
                        const payout = totalVal - bidVal;
                        const base = payout / count;
                        let fee = 0;
                        if (selectedTicket.host_fee_type === 'percentage') {
                          fee = (totalVal / count) * ((parseFloat(selectedTicket.host_fee_value) || 0) / 100);
                        } else {
                          fee = parseFloat(selectedTicket.host_fee_value) || 0;
                        }
                        const finalAmount = base + fee;
                        const roundNum = selectedTicket.current_round;

                        const noticeText = `ரூ ${totalVal.toLocaleString()}\n` +
                          `${roundNum}ம் சீட்டு கழிவு ரூ ${bidVal.toLocaleString()}\n` +
                          `💵 கிடைக்கும் தொகை:\n` +
                          `ரூ ${payout.toLocaleString()}\n` +
                          `💳 கட்டு காசு:\n` +
                          `ரூ ${finalAmount.toLocaleString()}\n` +
                          `📅 ${roundNum + 1}ம் சீட்டு திகதி:\n` +
                          `${auctionForm.next_round_date ? new Date(auctionForm.next_round_date).toLocaleDateString() : '____________'}`;

                        return (
                          <div style={{ border: '1px dashed var(--border-light)', borderRadius: '12px', padding: '16px', background: 'rgba(255,255,255,0.01)' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>✏️ Next Round {roundNum} Draft Notice</span>
                            <div style={{ background: '#334155', color: 'white', borderRadius: '8px', padding: '12px', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap', border: '1px solid var(--border-light)', marginBottom: '10px' }}>
                              {noticeText}
                            </div>
                            <button
                              type="button"
                              className="glass-btn glass-btn-secondary"
                              style={{ width: '100%', padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '12px' }}
                              onClick={() => {
                                const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(noticeText)}`;
                                window.open(url, '_blank');
                              }}
                            >
                              <MessageSquare style={{ width: '14px', height: '14px' }} /> Share Draft Notice to WhatsApp
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {activeTicketTab === 'members' && (
                  <div className="responsive-grid-2-col animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                    {/* Roster list */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                      <h3 style={{ fontSize: '18px', marginBottom: '14px', fontWeight: 'bold' }}><Users className="icon" /> Roster of Members</h3>
                      {ticketMembers.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No members added to this group yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden' }}>
                          {ticketMembers.map((m, idx) => {
                            const wonAuction = ticketAuctions.find(a => a.winner_member_id === m.id);
                            return (
                              <div key={m.id} className="ticket-member-row">
                                <div>
                                  <strong style={{ display: 'block', fontSize: '14px' }}>{idx + 1}. {m.name}</strong>
                                  {m.phone && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                      <span><Phone className="icon" style={{ width: '12px', height: '12px' }} /> {m.phone}</span>
                                      <span className="quick-contact-actions" onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px' }}>
                                        <a href={`tel:${m.phone}`} className="quick-contact-btn phone" title="Call Member" style={{ color: 'var(--accent-blue)' }}>
                                          <Phone style={{ width: '11px', height: '11px' }} />
                                        </a>
                                        <a href={`https://wa.me/${(m.phone || '').replace(/[^0-9]/g, '').startsWith('0') ? '94' + (m.phone || '').replace(/[^0-9]/g, '').slice(1) : (m.phone || '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="quick-contact-btn whatsapp" title="Chat on WhatsApp" style={{ color: '#25D366' }}>
                                          <MessageSquare style={{ width: '11px', height: '11px' }} />
                                        </a>
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  {wonAuction ? (
                                    <span className="badge badge-active" style={{ background: 'rgba(37, 84, 232, 0.1)', color: 'var(--accent-blue)', fontSize: '11px' }}>Won Round {wonAuction.round_number}</span>
                                  ) : (
                                    <span className="badge badge-defaulted" style={{ fontSize: '11px' }}>Not Won</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Add member form */}
                    <div className="glass-card" style={{ padding: '24px', alignSelf: 'flex-start' }}>
                      <h3 style={{ fontSize: '18px', marginBottom: '14px', fontWeight: 'bold' }}><UserPlus className="icon" /> Add Member to Group</h3>
                      {user.role === 'admin' ? (
                        <form onSubmit={handleAddTicketMember} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>FULL NAME *</label>
                            <input required type="text" className="glass-input" placeholder="e.g. S. Arulpragasam" value={newMemberForm.name} onChange={e => setNewMemberForm(prev => ({ ...prev, name: e.target.value }))} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>PHONE NUMBER</label>
                            <input type="tel" className="glass-input" placeholder="e.g. 0771234567" value={newMemberForm.phone} onChange={e => setNewMemberForm(prev => ({ ...prev, phone: e.target.value }))} />
                          </div>
                          <button type="submit" className="glass-btn glass-btn-emerald" disabled={loading} style={{ width: '100%', padding: '12px' }}>
                            Add Member to Roster
                          </button>
                        </form>
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Only Admin hosts can add members to a group roster.</p>
                      )}
                    </div>
                  </div>
                )}

                {activeTicketTab === 'payments' && (
                  <div className="glass-card animate-fade-in" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                      <h3 style={{ fontSize: '18px', margin: 0, fontWeight: 'bold' }}><CreditCard className="icon" /> Repayments Collection Tracker</h3>
                      
                      {/* Round filter selector */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>View Round:</span>
                        <select className="glass-input" style={{ width: '110px', padding: '6px 12px' }} value={ticketPaymentFilterRound} onChange={e => { setTicketPaymentFilterRound(e.target.value); handleFetchTicketPaymentsByRound(e.target.value); }}>
                          {Array.from({ length: selectedTicket.status === 'completed' ? selectedTicket.member_count : selectedTicket.current_round - 1 }, (_, i) => i + 1).map(r => (
                            <option key={r} value={r}>Round {r}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {ticketPayments.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No payments logged yet. Settle an auction round to generate payment logs.</p>
                    ) : (
                      <>
                        <div className="desktop-only" style={{ overflowX: 'auto' }}>
                          <table className="glass-table">
                            <thead>
                              <tr>
                                <th>Member Name</th>
                                <th>Contact</th>
                                <th>Amount Due</th>
                                <th>Collected?</th>
                                <th>Date Paid</th>
                                <th>Notify Reminder</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ticketPayments.map(p => {
                                const auction = ticketAuctions.find(a => a.round_number === p.round_number);
                                return (
                                  <tr key={p.id}>
                                    <td>
                                      <strong>{p.member_name}</strong>
                                    </td>
                                    <td>
                                      {p.member_phone ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span>{p.member_phone}</span>
                                          <span className="quick-contact-actions" onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px' }}>
                                            <a href={`tel:${p.member_phone}`} className="quick-contact-btn phone" title="Call" style={{ color: 'var(--accent-blue)' }}>
                                              <Phone style={{ width: '11px', height: '11px' }} />
                                            </a>
                                            <a href={`https://wa.me/${(p.member_phone || '').replace(/[^0-9]/g, '').startsWith('0') ? '94' + (p.member_phone || '').replace(/[^0-9]/g, '').slice(1) : (p.member_phone || '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="quick-contact-btn whatsapp" style={{ color: '#25D366' }}>
                                              <MessageSquare style={{ width: '11px', height: '11px' }} />
                                            </a>
                                          </span>
                                        </div>
                                      ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                                      )}
                                    </td>
                                    <td style={{ fontWeight: 'bold' }}>LKR {auction ? parseFloat(auction.amount_per_member).toLocaleString() : 'N/A'}</td>
                                    <td>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input
                                          type="checkbox"
                                          checked={p.is_paid}
                                          onChange={() => handleToggleTicketPayment(p.id, !p.is_paid)}
                                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-emerald)' }}
                                        />
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: p.is_paid ? 'var(--accent-emerald)' : 'var(--text-secondary)' }}>
                                          {p.is_paid ? 'Collected' : 'Pending'}
                                        </span>
                                      </label>
                                    </td>
                                    <td>{p.payment_date ? new Date(p.payment_date).toLocaleString() : '—'}</td>
                                    <td>
                                      {p.member_phone && !p.is_paid ? (
                                        <button className="glass-btn btn-whatsapp" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => {
                                          const clean = (p.member_phone || '').replace(/[^0-9]/g, '');
                                          const int = clean.startsWith('0') ? '94' + clean.slice(1) : (clean.startsWith('94') ? clean : '94' + clean);
                                          const txt = `*STN CHIT FUND - PAYMENT REMINDER*\n\n` +
                                            `Group: *${selectedTicket.name}*\n` +
                                            `Round: *Round ${p.round_number}*\n` +
                                            `Amount Due: *LKR ${auction ? parseFloat(auction.amount_per_member).toLocaleString() : 'N/A'}*\n\n` +
                                            `Please make your payment to the host. Thank you!`;
                                          window.open(`https://wa.me/${int}?text=${encodeURIComponent(txt)}`, '_blank');
                                        }}>
                                          Notify
                                        </button>
                                      ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Checklist */}
                        <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {ticketPayments.map(p => {
                            const auction = ticketAuctions.find(a => a.round_number === p.round_number);
                            return (
                              <div key={p.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <strong style={{ display: 'block', fontSize: '14px' }}>{p.member_name}</strong>
                                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    Due: <strong>LKR {auction ? parseFloat(auction.amount_per_member).toLocaleString() : 'N/A'}</strong>
                                  </div>
                                  {p.member_phone && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}><Phone className="icon" style={{ width: '10px' }} /> {p.member_phone}</span>
                                      <span className="quick-contact-actions" style={{ display: 'flex', gap: '4px' }}>
                                        <a href={`tel:${p.member_phone}`} className="quick-contact-btn phone" title="Call" style={{ color: 'var(--accent-blue)' }}>
                                          <Phone style={{ width: '11px', height: '11px' }} />
                                        </a>
                                        <a href={`https://wa.me/${(p.member_phone || '').replace(/[^0-9]/g, '').startsWith('0') ? '94' + (p.member_phone || '').replace(/[^0-9]/g, '').slice(1) : (p.member_phone || '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="quick-contact-btn whatsapp" style={{ color: '#25D366' }}>
                                          <MessageSquare style={{ width: '11px', height: '11px' }} />
                                        </a>
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
                                    <input
                                      type="checkbox"
                                      checked={p.is_paid}
                                      onChange={() => handleToggleTicketPayment(p.id, !p.is_paid)}
                                      style={{ width: '22px', height: '22px', accentColor: 'var(--accent-emerald)', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: p.is_paid ? 'var(--accent-emerald)' : 'var(--text-secondary)' }}>
                                      {p.is_paid ? 'Collected' : 'Pending'}
                                    </span>
                                  </label>
                                  {p.member_phone && !p.is_paid && (
                                    <button className="glass-btn btn-whatsapp" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => {
                                      const clean = (p.member_phone || '').replace(/[^0-9]/g, '');
                                      const int = clean.startsWith('0') ? '94' + clean.slice(1) : (clean.startsWith('94') ? clean : '94' + clean);
                                      const txt = `*STN CHIT FUND - PAYMENT REMINDER*\n\n` +
                                        `Group: *${selectedTicket.name}*\n` +
                                        `Round: *Round ${p.round_number}*\n` +
                                        `Amount Due: *LKR ${auction ? parseFloat(auction.amount_per_member).toLocaleString() : 'N/A'}*\n\n` +
                                        `Please make your payment to the host. Thank you!`;
                                      window.open(`https://wa.me/${int}?text=${encodeURIComponent(txt)}`, '_blank');
                                    }}>
                                      Notify
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTicketTab === 'history' && (
                  <div className="glass-card animate-fade-in" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '18px', marginBottom: '14px', fontWeight: 'bold' }}><ScrollText className="icon" /> Auctions & Rounds History Log</h3>
                    {ticketAuctions.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No auction rounds completed yet.</p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="glass-table">
                          <thead>
                            <tr>
                              <th>Round #</th>
                              <th>Date</th>
                              <th>Bid (கழிவு)</th>
                              <th>Winner Member</th>
                              <th>Payout to Winner</th>
                              <th>Repayment / Member</th>
                              <th>Host Fee Collected</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ticketAuctions.map(a => (
                              <tr key={a.id}>
                                <td style={{ fontWeight: 'bold' }}>Round {a.round_number}</td>
                                <td>{new Date(a.auction_date).toLocaleDateString()}</td>
                                <td style={{ color: 'var(--accent-rose)', fontWeight: 'bold' }}>LKR {parseFloat(a.bid_amount).toLocaleString()}</td>
                                <td><strong>{a.winner_name || 'N/A (No Winner)'}</strong></td>
                                <td style={{ color: 'var(--accent-emerald)', fontWeight: 'bold' }}>LKR {parseFloat(a.winner_payout).toLocaleString()}</td>
                                <td>LKR {parseFloat(a.amount_per_member).toLocaleString()}</td>
                                <td>LKR {(parseFloat(a.host_fee_per_member) * selectedTicket.member_count).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

          </div>
        )}

        {/* ----------------- ADMIN PORTAL VIEWS ----------------- */}
        {token && user && user.role === 'admin' && adminData && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* View 1: Main Grid Action Menu */}
            {view === 'dashboard' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {/* KPI Metrics row */}
                <div className="kpi-grid-main" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>

                  {/* Card 0: Pending Approvals — only shown when there's something to review */}
                  {adminData.summary.pendingApprovalsCount > 0 && (
                    <div className="kpi-card" style={{ borderLeft: '4px solid var(--accent-amber)', cursor: 'pointer' }} onClick={() => setView('loans')}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span className="kpi-lbl">Pending Approvals</span>
                          <h3 className="kpi-val" style={{ color: 'var(--accent-amber)' }}>
                            {adminData.summary.pendingApprovalsCount} Loan{adminData.summary.pendingApprovalsCount === 1 ? '' : 's'}
                          </h3>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                            Submitted by agents, awaiting your review
                          </span>
                        </div>
                        <div className="kpi-icon-bubble" style={{ background: '#fffbeb', color: '#b45309' }}>
                          <Clock style={{ width: '22px', height: '22px' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card 1: Active Loans & Outstanding Principal */}
                  <div className="kpi-card kpi-card-blue">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span className="kpi-lbl">Active Loans</span>
                        <h3 className="kpi-val">{adminData.summary.totalActiveLoans}</h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                          Out Principal: <strong>LKR {adminData.summary.totalPrincipalOutstanding.toLocaleString()}</strong>
                        </span>
                      </div>
                      <div className="kpi-icon-bubble blue">
                        <ClipboardList style={{ width: '22px', height: '22px' }} />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Total Disbursed */}
                  <div className="kpi-card kpi-card-blue">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span className="kpi-lbl">Total Disbursed</span>
                        <h3 className="kpi-val">LKR {adminData.summary.totalMoneyLent.toLocaleString()}</h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                          Total Capital Issued
                        </span>
                      </div>
                      <div className="kpi-icon-bubble blue">
                        <Banknote style={{ width: '22px', height: '22px' }} />
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Collection Progress with Filter Selector */}
                  <div className="kpi-card kpi-card-emerald">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span className="kpi-lbl">Collections Progress</span>
                      <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                        <button
                          type="button"
                          onClick={() => setCollectionSummaryMode('today')}
                          style={{
                            padding: '3px 8px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer',
                            background: collectionSummaryMode === 'today' ? 'var(--accent-emerald)' : 'transparent',
                            color: collectionSummaryMode === 'today' ? '#fff' : 'var(--text-secondary)'
                          }}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => setCollectionSummaryMode('all-time')}
                          style={{
                            padding: '3px 8px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer',
                            background: collectionSummaryMode === 'all-time' ? 'var(--accent-emerald)' : 'transparent',
                            color: collectionSummaryMode === 'all-time' ? '#fff' : 'var(--text-secondary)'
                          }}
                        >
                          All-Time
                        </button>
                      </div>
                    </div>
                    {collectionSummaryMode === 'today' ? (
                      <div>
                        <h3 className="kpi-val" style={{ color: 'var(--accent-emerald)' }}>
                          LKR {(adminData.dailyReport?.collectionsToday || 0).toLocaleString()}
                        </h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                          Target Today: <strong>LKR {(adminData.summary.expectedTodayTarget || 0).toLocaleString()}</strong>
                        </span>
                      </div>
                    ) : (
                      <div>
                        <h3 className="kpi-val" style={{ color: 'var(--accent-emerald)' }}>
                          LKR {adminData.summary.totalRepayments.toLocaleString()}
                        </h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                          Total Cash Collected All-Time
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card 4: Agent Cash in Hand */}
                  <div className="kpi-card kpi-card-blue">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span className="kpi-lbl">Agent Cash in Hand</span>
                        <h3 className="kpi-val" style={{ color: 'var(--accent-amber)' }}>
                          LKR {(adminData.summary.agentCashInHand || 0).toLocaleString()}
                        </h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                          Collected by agents, unremitted
                        </span>
                      </div>
                      <div className="kpi-icon-bubble" style={{ background: '#fef3c7', color: '#d97706' }}>
                        <Briefcase style={{ width: '22px', height: '22px' }} />
                      </div>
                    </div>
                  </div>

                  {/* Card 5: Overdue Loans Summary */}
                  <div className="kpi-card" style={{ borderLeft: '4px solid var(--accent-rose)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span className="kpi-lbl">Overdue Summary</span>
                        <h3 className="kpi-val" style={{ color: 'var(--accent-rose)' }}>
                          {adminData.summary.totalOverdue} Loans
                        </h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                          Overdue Balance: <strong>LKR {(adminData.summary.totalOverdueAmount || 0).toLocaleString()}</strong>
                        </span>
                      </div>
                      <div className="kpi-icon-bubble" style={{ background: '#ffe4e6', color: '#e11d48' }}>
                        <AlertTriangle style={{ width: '22px', height: '22px' }} />
                      </div>
                    </div>
                  </div>

                </div>

                {/* Pending loan applications awaiting admin review */}
                {adminData.pendingApprovals && adminData.pendingApprovals.length > 0 && (
                  <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-amber)' }}>
                    <h3 style={{ fontSize: '24px', marginBottom: '16px', color: 'var(--accent-amber)' }}><Clock className="icon" /> Loan Applications Awaiting Approval</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {adminData.pendingApprovals.map(loan => (
                        <div key={loan.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '14px 16px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '12px' }}>
                          <div>
                            <strong style={{ display: 'block', fontSize: '15px' }}>{loan.borrower_name}</strong>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><Phone className="icon" /> {loan.borrower_phone}</span>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                              Submitted by <strong>{loan.submitted_by_name || 'Office'}</strong> · {new Date(loan.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--accent-amber)' }}>LKR {parseFloat(loan.principal_amount).toLocaleString()}</span>
                            <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '700' }} onClick={() => viewStatement(loan.id)}>
                              Review &rarr;
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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

                  <div className="menu-card menu-card-give" onClick={() => setView('next-day-tasklist')}>
                    <span className="menu-card-icon"><Calendar /></span>
                    <div>
                      <h3 style={{ fontSize: '26px', marginBottom: '10px', fontWeight: '800', color: 'var(--accent-emerald)' }}>Next Day Tasklist</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: '1.5' }}>View scheduled collections for tomorrow categorized by Daily, Weekly, and Monthly routes</p>
                    </div>
                  </div>

                  <div className="menu-card menu-card-check" onClick={() => setView('record-payment')}>
                    <span className="menu-card-icon"><CreditCard /></span>
                    <div>
                      <h3 style={{ fontSize: '26px', marginBottom: '10px', fontWeight: '800', color: 'var(--accent-blue)' }}>Record Payment</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: '1.5' }}>Inline daily collection sheet: check full due or enter custom partial amounts (e.g. 200) on the same line</p>
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

                  <div className="menu-card menu-card-gold" onClick={() => setView('interest-center')}>
                    <span className="menu-card-icon"><TrendingUp /></span>
                    <div>
                      <h3 style={{ fontSize: '26px', marginBottom: '10px', fontWeight: '800', color: 'var(--accent-gold)' }}>Interest Accrual Center</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: '1.5' }}>Revenue breakdown by collection frequency, formulas, and recent accrual logs</p>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* View: Interest Accrual & Formula Dashboard — pulled out of the
                dashboard home so it doesn't force every admin to scroll past
                a reporting page just to reach "What do you want to do?". */}
            {view === 'interest-center' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <button className="glass-btn glass-btn-secondary" style={{ fontSize: '15px', fontWeight: 'bold' }} onClick={() => setView('dashboard')}>
                  <ArrowLeft className="icon" /> Back to Main Menu
                </button>

                <div className="glass-card">
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
                          <strong style={{ color: 'var(--accent-blue)', display: 'block', marginBottom: '4px' }}>Daily Collection Formula:</strong>
                          <span style={{ color: 'var(--text-secondary)' }}><code>Daily Interest = (Principal × Rate / 100) / 30</code> accrued every 24h. Over 60 days = 2 months interest.</span>
                        </div>
                        <div>
                          <strong style={{ color: 'var(--accent-blue)', display: 'block', marginBottom: '4px' }}>Weekly Collection Formula:</strong>
                          <span style={{ color: 'var(--text-secondary)' }}><code>Weekly Interest = (Principal × Rate / 100) / 4</code> accrued every 7 days.</span>
                        </div>
                        <div>
                          <strong style={{ color: 'var(--accent-blue)', display: 'block', marginBottom: '4px' }}>Monthly Collection Formula:</strong>
                          <span style={{ color: 'var(--text-secondary)' }}><code>Monthly Interest = Principal × Rate / 100</code> accrued on calendar month dates (e.g. Mar 4th → Apr 4th → May 4th).</span>
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
                                {loan.reference_number && (
                                  <span style={{ fontSize: '11px', color: 'var(--accent-blue)', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: 'bold' }}>
                                    {loan.reference_number}
                                  </span>
                                )}
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
                            <span className="mobile-row-card-title">
                              {loan.borrower_name}
                              {loan.reference_number && (
                                <span style={{ fontSize: '10px', color: 'var(--accent-blue)', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: 'bold' }}>
                                  {loan.reference_number}
                                </span>
                              )}
                            </span>
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

                {/* Users & Cash Tools bundles several unrelated admin
                    functions (cash reconciliation, remittances, the ledger
                    report, user management) — tabs keep each one a short,
                    focused screen instead of one long undifferentiated
                    scroll. Reuses the exact .loan-file-tabs/.loan-file-tab
                    pattern from the loan detail page for visual consistency
                    rather than inventing a second tab style. */}
                <div className="loan-file-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', gap: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  {[
                    { key: 'cash', label: 'Cash & Remittances', Icon: Briefcase },
                    { key: 'ledger', label: 'Ledger Report', Icon: BookOpen },
                    { key: 'users', label: 'User Management', Icon: User },
                    { key: 'reminders', label: 'Reminder Settings & Alerts', Icon: Bell }
                  ].map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      className="loan-file-tab"
                      onClick={() => setAdminToolsTab(key)}
                      style={{
                        padding: '12px 16px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        background: 'none',
                        border: 'none',
                        borderBottom: adminToolsTab === key ? '3px solid var(--accent-blue)' : '3px solid transparent',
                        color: adminToolsTab === key ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Icon className="icon" style={{ fontSize: '16px' }} /> {label}
                    </button>
                  ))}
                </div>

                {adminToolsTab === 'cash' && (
                <>
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
                </>
                )}

                {adminToolsTab === 'ledger' && (
                <>
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
                </>
                )}

                {adminToolsTab === 'users' && (
                <>
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
                      <div style={{ display: 'flex', gap: '20px', margin: '4px 0 12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!newUserForm.finance_access} onChange={e => setNewUserForm(prev => ({ ...prev, finance_access: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-blue)' }} />
                          Finance Portal Access
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!newUserForm.ticket_access} onChange={e => setNewUserForm(prev => ({ ...prev, ticket_access: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-emerald)' }} />
                          Ticket Portal Access
                        </label>
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
                          <th>Permissions</th>
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
                              <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ color: u.finance_access !== false ? 'var(--accent-blue)' : 'var(--text-muted)', fontWeight: u.finance_access !== false ? '600' : '400' }}>Finance: {u.finance_access !== false ? 'Yes' : 'No'}</span>
                                <span style={{ color: u.ticket_access !== false ? 'var(--accent-emerald)' : 'var(--text-muted)', fontWeight: u.ticket_access !== false ? '600' : '400' }}>Ticket: {u.ticket_access !== false ? 'Yes' : 'No'}</span>
                              </div>
                            </td>
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
                              {u.role !== 'borrower' && (
                                <button className="glass-btn glass-btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleResetUserPassword(u)} disabled={loading}>
                                  Reset Password
                                </button>
                              )}
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
                          {u.role !== 'borrower' && (
                            <button className="glass-btn glass-btn-secondary" onClick={() => handleResetUserPassword(u)} disabled={loading}>
                              Reset Password
                            </button>
                          )}
                          <button className="glass-btn glass-btn-rose" onClick={() => handleDeleteUser(u)} disabled={loading || u.id === user.id}>
                            <Trash2 className="icon" /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                </>
                )}

                {adminToolsTab === 'reminders' && (
                  <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                      <div>
                        <h3 style={{ fontSize: '22px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Bell className="icon" style={{ color: 'var(--accent-amber)' }} /> Overdue Reminder Settings & Alert Controls
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                          Configure automated overdue alert thresholds. If payments are not recorded within this threshold, automated notifications and alerts are triggered.
                        </p>
                      </div>
                    </div>

                    {/* Setting Form */}
                    <div style={{ padding: '18px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', marginBottom: '24px', maxWidth: '520px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        OVERDUE REMINDER THRESHOLD (DAYS)
                      </label>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          className="glass-input"
                          value={overdueDaysThreshold}
                          onChange={e => handleUpdateOverdueThreshold(e.target.value)}
                          style={{ width: '120px', padding: '10px', fontSize: '16px', fontWeight: 'bold' }}
                        />
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Days uncollected past due</span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>
                        Active loans uncollected for more than {overdueDaysThreshold} days will trigger overdue alerts for Admins and Agents.
                      </span>
                    </div>

                    {/* Overdue Loans Table */}
                    <h4 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
                      Active Loans Overdue ({overdueDaysThreshold}+ Days)
                    </h4>
                    {(() => {
                      const now = new Date();
                      const overdueLoansList = (adminData.overdueLoans || []).filter(l => {
                        if (l.status !== 'active') return false;
                        const lastAcc = l.last_accrual_date ? new Date(l.last_accrual_date) : new Date(l.created_at);
                        const diffDays = Math.floor((now - lastAcc) / (1000 * 60 * 60 * 24));
                        return diffDays >= overdueDaysThreshold;
                      });

                      if (overdueLoansList.length === 0) {
                        return (
                          <div className="empty-state">
                            <div className="empty-state-icon"><CircleCheck style={{ width: '28px', height: '28px', color: 'var(--accent-emerald)' }} /></div>
                            <h4 className="empty-state-title">No Loans Past {overdueDaysThreshold} Days Overdue</h4>
                            <p className="empty-state-text">All active customer accounts are up to date within the configured threshold.</p>
                          </div>
                        );
                      }

                      return (
                        <div style={{ overflowX: 'auto' }}>
                          <table className="glass-table">
                            <thead>
                              <tr>
                                <th>Loan Ref ID</th>
                                <th>Borrower</th>
                                <th>Category</th>
                                <th>Uncollected Interest</th>
                                <th>Days Overdue</th>
                                <th>Collector</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {overdueLoansList.map(l => {
                                const lastAcc = l.last_accrual_date ? new Date(l.last_accrual_date) : new Date(l.created_at);
                                const diffDays = Math.floor((now - lastAcc) / (1000 * 60 * 60 * 24));
                                return (
                                  <tr key={l.id}>
                                    <td style={{ fontWeight: 'bold' }}>{l.reference_number || `STN-${String(l.id).padStart(3, '0')}`}</td>
                                    <td>
                                      <strong>{l.borrower_name}</strong>
                                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)' }}>{l.borrower_phone}</span>
                                    </td>
                                    <td style={{ textTransform: 'capitalize' }}>{l.interest_type}</td>
                                    <td style={{ fontWeight: 'bold', color: 'var(--accent-rose)' }}>LKR {parseFloat(l.interest_balance).toLocaleString()}</td>
                                    <td>
                                      <span className="badge badge-defaulted">{diffDays} Days Overdue</span>
                                    </td>
                                    <td>{l.agent_name || 'Office Staff'}</td>
                                    <td>
                                      <button
                                        className="glass-btn glass-btn-secondary"
                                        style={{ padding: '6px 10px', fontSize: '12px' }}
                                        onClick={() => {
                                          if (l.interest_type !== 'daily') {
                                            showToast(`Sent SMS reminder to ${l.borrower_name} (${l.borrower_phone})`);
                                          } else {
                                            showToast(`In-app alert recorded for ${l.borrower_name}. (Daily loans exclude SMS)`);
                                          }
                                        }}
                                      >
                                        Send Alert
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                )}

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
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>EMAIL (OPTIONAL)</label>
                          <input type="email" className="glass-input" value={editUserForm.email || ''} onChange={e => setEditUserForm(prev => ({ ...prev, email: e.target.value }))} />
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
                        <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={!!editUserForm.finance_access} onChange={e => setEditUserForm(prev => ({ ...prev, finance_access: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-blue)' }} />
                            Finance Portal Access
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={!!editUserForm.ticket_access} onChange={e => setEditUserForm(prev => ({ ...prev, ticket_access: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-emerald)' }} />
                            Ticket Portal Access
                          </label>
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

            {view === 'record-payment' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button className="glass-btn glass-btn-secondary" style={{ fontSize: '15px', fontWeight: 'bold' }} onClick={() => setView('dashboard')}>
                    <ArrowLeft className="icon" /> Back to Main Menu
                  </button>
                </div>
                <RecordDailyPaymentsTab loans={[]} onRefresh={fetchDashboardData} showToast={showToast} />
              </div>
            )}

            {view === 'next-day-tasklist' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button className="glass-btn glass-btn-secondary" style={{ fontSize: '15px', fontWeight: 'bold' }} onClick={() => setView('dashboard')}>
                    <ArrowLeft className="icon" /> Back to Main Menu
                  </button>
                </div>
                <NextDayTasklistTab loans={[]} onSelectLoan={(id) => { setSelectedLoanId(id); setView('loans'); }} onNavigateRecordPayment={() => setView('record-payment')} />
              </div>
            )}

          </div>
        )}

            {token && user && (user.role === 'admin' || user.role === 'agent') && view === 'create-loan' && (
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
                      
                      <div className="wizard-progress-bar" style={{ height: '4px', background: 'var(--border-light)', borderRadius: '2px', margin: '8px 0 16px', overflow: 'hidden' }}>
                        <div className="wizard-progress-bar-fill" style={{ height: '100%', background: 'var(--accent-blue)', transition: 'width 0.3s ease', width: `${(giveLoanStep / (includeGuarantor ? 4 : 3)) * 100}%` }} />
                      </div>

                      <div className="wizard-step-nodes-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <button type="button" 
                          className={`step-indicator ${giveLoanStep === 1 ? 'active' : 'completed'}`}
                          onClick={() => setGiveLoanStep(1)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center', textAlign: 'left', width: '100%' }}
                        >
                          <div className="step-number" style={{ width: '28px', height: '28px', borderRadius: '50%', background: giveLoanStep > 1 ? 'var(--accent-emerald)' : 'var(--accent-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                            {giveLoanStep > 1 ? <Check style={{ width: '16px', height: '16px' }} /> : '1'}
                          </div>
                          <div>
                            <div className="step-label" style={{ fontWeight: '700', fontSize: '14px' }}>KYC Profile</div>
                            <span className="step-subtext" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Identity & DOB</span>
                          </div>
                        </button>

                        <button type="button" 
                          className={`step-indicator ${giveLoanStep === 2 ? 'active' : giveLoanStep > 2 ? 'completed' : ''}`}
                          onClick={() => { if (runKYCValidation()) setGiveLoanStep(2); }}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center', textAlign: 'left', width: '100%' }}
                        >
                          <div className="step-number" style={{ width: '28px', height: '28px', borderRadius: '50%', background: giveLoanStep > 2 ? 'var(--accent-emerald)' : (giveLoanStep === 2 ? 'var(--accent-blue)' : 'var(--border-strong)'), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                            {giveLoanStep > 2 ? <Check style={{ width: '16px', height: '16px' }} /> : '2'}
                          </div>
                          <div>
                            <div className="step-label" style={{ fontWeight: '700', fontSize: '14px' }}>Financial Profile</div>
                            <span className="step-subtext" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Earnings & Family</span>
                          </div>
                        </button>

                        <button type="button" 
                          className={`step-indicator ${giveLoanStep === 3 ? 'active' : giveLoanStep > 3 ? 'completed' : ''}`}
                          onClick={() => { if (runKYCValidation() && runFinancialValidation()) setGiveLoanStep(3); }}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center', textAlign: 'left', width: '100%' }}
                        >
                          <div className="step-number" style={{ width: '28px', height: '28px', borderRadius: '50%', background: giveLoanStep > 3 ? 'var(--accent-emerald)' : (giveLoanStep === 3 ? 'var(--accent-blue)' : 'var(--border-strong)'), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                            {giveLoanStep > 3 ? <Check style={{ width: '16px', height: '16px' }} /> : '3'}
                          </div>
                          <div>
                            <div className="step-label" style={{ fontWeight: '700', fontSize: '14px' }}>Loan Terms</div>
                            <span className="step-subtext" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Interest & Agent</span>
                          </div>
                        </button>

                        {includeGuarantor && (
                          <button type="button" 
                            className={`step-indicator ${giveLoanStep === 4 ? 'active' : ''}`}
                            onClick={() => { if (runKYCValidation() && runFinancialValidation() && runTermsValidation()) setGiveLoanStep(4); }}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center', textAlign: 'left', width: '100%' }}
                          >
                            <div className="step-number" style={{ width: '28px', height: '28px', borderRadius: '50%', background: giveLoanStep === 4 ? 'var(--accent-blue)' : 'var(--border-strong)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                              4
                            </div>
                            <div>
                              <div className="step-label" style={{ fontWeight: '700', fontSize: '14px' }}>Guarantor Info</div>
                              <span className="step-subtext" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Security Backup</span>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Wizard Body / Form Content */}
                    <div className="wizard-body">
                      <h3 style={{ fontSize: '28px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Banknote className="icon" style={{ color: 'var(--accent-blue)', fontSize: '24px' }} /> Give New Loan
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                        STEP {giveLoanStep} OF {includeGuarantor ? '4' : '3'}: {' '}
                        {giveLoanStep === 1 && "Borrower Identity & KYC Details"}
                        {giveLoanStep === 2 && "Borrower Financial Profile & Spouse Info"}
                        {giveLoanStep === 3 && "Scheduling, Accrual terms, and Agent Assignment"}
                        {giveLoanStep === 4 && "Guarantor security backing verification"}
                      </p>

                      <form noValidate onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {giveLoanStep === 1 && (
                          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* --- SECTION 1: BORROWER DETAILS --- */}
                            <div style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', margin: '0', fontSize: '15px' }}>
                                <User className="icon" /> 1. BORROWER PERSONAL DETAILS (KYC)
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
                                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>DATE OF BIRTH *</label>
                                  <input id="date_of_birth" type="date" max={new Date().toISOString().slice(0, 10)} className="glass-input" style={{ borderColor: validationErrors.date_of_birth ? 'var(--accent-rose)' : '', borderWidth: validationErrors.date_of_birth ? '2px' : '' }} value={newLoan.date_of_birth} onChange={e => { setNewLoan(prev => ({ ...prev, date_of_birth: e.target.value })); clearFieldError('date_of_birth'); }} />
                                  {validationErrors.date_of_birth && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors.date_of_birth}</span>}
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

                              <div>
                                <label id="address_proof" style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>ADDRESS PROOF (e.g. utility bill) *</label>
                                <input type="file" accept="image/*" className="glass-input" style={{ borderColor: validationErrors.address_proof ? 'var(--accent-rose)' : '', borderWidth: validationErrors.address_proof ? '2px' : '' }} onChange={e => { handleAddressProofChange(e); clearFieldError('address_proof'); }} />
                                {newLoan.address_proof && (
                                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <img src={newLoan.address_proof} alt="Address proof preview" style={{ width: '45px', height: '30px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-glass)' }} />
                                    <span style={{ fontSize: '11px', color: 'var(--accent-emerald)' }}><CircleCheck className="icon" /> Photo Attached</span>
                                  </div>
                                )}
                                {validationErrors.address_proof && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors.address_proof}</span>}
                              </div>
                            </div>

                            <button 
                              type="button" 
                              className="glass-btn glass-btn-emerald" 
                              onClick={() => handleWizardNext(1)}
                              style={{ width: '100%', marginTop: '10px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '15px' }}
                            >
                              Continue to Financials <ArrowRight className="icon" />
                            </button>
                          </div>
                        )}

                        {giveLoanStep === 2 && (
                          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

                            <div style={{ display: 'flex', gap: '12px' }}>
                              <button type="button" className="glass-btn glass-btn-secondary" onClick={() => handleWizardBack(2)} style={{ flex: 1, padding: '16px' }}>Back</button>
                              <button type="button" className="glass-btn glass-btn-emerald" onClick={() => handleWizardNext(2)} style={{ flex: 2, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                Continue to Terms <ArrowRight className="icon" />
                              </button>
                            </div>
                          </div>
                        )}

                        {giveLoanStep === 3 && (
                          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* --- SECTION 3: LOAN DETAILS & TERMS --- */}
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
                                      {newLoan.interest_type === 'daily'
                                        ? 'DURATION (days) — 31 = 1 month, 62 = 2 months, 93 = 3 months *'
                                        : `DURATION (in ${newLoan.interest_type === 'weekly' ? 'weeks' : 'months'}) *`}
                                    </label>
                                    <input id="duration_periods" type="number" min="1" required className="glass-input" style={{ borderColor: validationErrors.duration_periods ? 'var(--accent-rose)' : '', borderWidth: validationErrors.duration_periods ? '2px' : '' }} placeholder={newLoan.interest_type === 'daily' ? 'e.g. 31, 62, or 93' : 'e.g. 30'} value={newLoan.duration_periods} onChange={e => { setNewLoan(prev => ({ ...prev, duration_periods: e.target.value })); clearFieldError('duration_periods'); }} />
                                    {newLoan.interest_type === 'daily' && (
                                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                        {[31, 62, 93].map(d => (
                                          <button key={d} type="button" className={`glass-btn ${String(newLoan.duration_periods) === String(d) ? 'glass-btn-emerald' : 'glass-btn-secondary'}`} style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => { setNewLoan(prev => ({ ...prev, duration_periods: String(d) })); clearFieldError('duration_periods'); }}>
                                            {d} days ({d === 31 ? '1' : d === 62 ? '2' : '3'} mo)
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    {validationErrors.duration_periods && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors.duration_periods}</span>}
                                  </div>
                                )}
                              </div>

                              {newLoan.interest_type === 'daily' && newLoan.collection_mode === 'fixed_term'
                                ? (newLoan.principal_amount > 0 && newLoan.interest_rate > 0 && parseInt(newLoan.duration_periods, 10) > 0 && parseInt(newLoan.duration_periods, 10) % 31 === 0) && (() => {
                                    const p = parseFloat(newLoan.principal_amount) || 0;
                                    const r = parseFloat(newLoan.interest_rate) || 0;
                                    const d = parseInt(newLoan.duration_periods, 10);
                                    const numMonths = d / 31;
                                    const nominalDays = d - numMonths;
                                    const totalInterest = p * (r / 100) * numMonths;
                                    const dailyInstallment = (p + totalInterest) / nominalDays;
                                    const trueTotal = dailyInstallment * d;
                                    return (
                                      <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Flat Daily Installment (principal + interest):</span><strong style={{ color: 'var(--accent-blue)' }}>LKR {dailyInstallment.toLocaleString(undefined, { maximumFractionDigits: 2 })}/day</strong></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Collected for:</span><strong>{d} days ({nominalDays} nominal + {numMonths} extra day{numMonths > 1 ? 's' : ''})</strong></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-light)', paddingTop: '4px', marginTop: '2px' }}><span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Total Repayable:</span><strong style={{ color: 'var(--accent-emerald)' }}>LKR {trueTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div>
                                      </div>
                                    );
                                  })()
                                : (newLoan.principal_amount > 0 && newLoan.interest_rate > 0 && (
                                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>
                                    {(() => {
                                      const p = parseFloat(newLoan.principal_amount) || 0;
                                      const r = parseFloat(newLoan.interest_rate) || 0;
                                      const monthlyInt = p * (r / 100);
                                      const perPeriod = newLoan.interest_type === 'daily' ? monthlyInt / 30 : newLoan.interest_type === 'weekly' ? monthlyInt / 4 : monthlyInt;
                                      return `Monthly interest: LKR ${monthlyInt.toLocaleString(undefined, { maximumFractionDigits: 2 })} (at ${r}% monthly rate). Collection mode '${newLoan.interest_type}': borrower is charged LKR ${perPeriod.toLocaleString(undefined, { maximumFractionDigits: 2 })} per ${newLoan.interest_type === 'daily' ? 'day (30 days = 1 month of interest)' : newLoan.interest_type === 'weekly' ? 'week' : 'month'}.`;
                                    })()}
                                  </p>
                                ))}

                              {user.role === 'agent' ? (
                                <div style={{ padding: '12px 14px', background: 'var(--accent-blue-light)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <ClipboardCheck className="icon" /> You'll be the collection agent for this loan once it's approved.
                                </div>
                              ) : (
                                <div>
                                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>ASSIGN COLLECTION AGENT</label>
                                  <select className="glass-input" value={newLoan.assigned_agent_id} onChange={e => setNewLoan(prev => ({ ...prev, assigned_agent_id: e.target.value }))}>
                                    <option value="">-- No Agent (Self Collect) --</option>
                                    {agentsList.map(a => (
                                      <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>

                            {/* --- SECTION 4: GUARANTOR CHECKBOX --- */}
                            <div style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(255,255,255,0.01)' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', margin: 0 }}>
                                <input type="checkbox" checked={includeGuarantor} onChange={e => {
                                  setIncludeGuarantor(e.target.checked);
                                  if (!e.target.checked && giveLoanStep === 4) {
                                    setGiveLoanStep(3);
                                  }
                                }} />
                                <ShieldCheck className="icon" /> ADD GUARANTOR DETAILS (OPTIONAL)
                              </label>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '24px', marginTop: '-8px' }}>
                                Checking this will add a fourth step to fill in the guarantor personal, income and expense details.
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                              <button type="button" className="glass-btn glass-btn-secondary" onClick={() => handleWizardBack(3)} style={{ flex: 1, padding: '16px' }}>Back</button>
                              <button type="button" className="glass-btn glass-btn-emerald" onClick={() => handleWizardNext(3)} style={{ flex: 2, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                {includeGuarantor ? <>Continue to Guarantor <ArrowRight className="icon" /></> : (user.role === 'agent' ? <><ClipboardCheck className="icon" /> Submit for Approval</> : 'Disburse Cash Loan')}
                              </button>
                            </div>
                          </div>
                        )}

                        {giveLoanStep === 4 && includeGuarantor && (
                          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {guarantorForms.length > 1 && (
                              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <ClipboardCheck className="icon" /> {guarantorForms.length} guarantor forms required (matches Number of Dependents entered in Step 1).
                              </p>
                            )}
                            {guarantorForms.map((g, i) => (
                              <div key={i} style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', margin: '0', fontSize: '15px' }}>
                                  <ShieldCheck className="icon" /> 4. GUARANTOR DETAILS {guarantorForms.length > 1 ? `(${i + 1} of ${guarantorForms.length})` : ''}
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  <div className="form-grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div>
                                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Full Name *</label>
                                      <input id={`guarantor_${i}_full_name`} type="text" className="glass-input" style={{ borderColor: validationErrors[`guarantor_${i}_full_name`] ? 'var(--accent-rose)' : '', borderWidth: validationErrors[`guarantor_${i}_full_name`] ? '2px' : '' }} value={g.full_name} onChange={e => { updateGuarantorField(i, 'full_name', e.target.value); clearFieldError(`guarantor_${i}_full_name`); }} />
                                      {validationErrors[`guarantor_${i}_full_name`] && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors[`guarantor_${i}_full_name`]}</span>}
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>NIC Number *</label>
                                      <input id={`guarantor_${i}_nic_number`} type="text" className="glass-input" style={{ borderColor: validationErrors[`guarantor_${i}_nic_number`] ? 'var(--accent-rose)' : '', borderWidth: validationErrors[`guarantor_${i}_nic_number`] ? '2px' : '' }} placeholder="e.g. 199012345678 or 123456789V" value={g.nic_number} onChange={e => { updateGuarantorField(i, 'nic_number', e.target.value); clearFieldError(`guarantor_${i}_nic_number`); }} />
                                      {validationErrors[`guarantor_${i}_nic_number`] && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors[`guarantor_${i}_nic_number`]}</span>}
                                    </div>
                                  </div>

                                  <div>
                                    <label id={`guarantor_${i}_nic_photo`} style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>NIC Photo *</label>
                                    <input type="file" accept="image/*" className="glass-input" style={{ borderColor: validationErrors[`guarantor_${i}_nic_photo`] ? 'var(--accent-rose)' : '', borderWidth: validationErrors[`guarantor_${i}_nic_photo`] ? '2px' : '' }} onChange={e => { handleGuarantorPhotoChange(i, e); clearFieldError(`guarantor_${i}_nic_photo`); }} />
                                    {g.nic_photo && (
                                      <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <img src={g.nic_photo} alt="Guarantor NIC preview" style={{ width: '45px', height: '30px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-glass)' }} />
                                        <span style={{ fontSize: '11px', color: 'var(--accent-emerald)' }}><CircleCheck className="icon" /> Photo Attached</span>
                                      </div>
                                    )}
                                    {validationErrors[`guarantor_${i}_nic_photo`] && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors[`guarantor_${i}_nic_photo`]}</span>}
                                  </div>

                                  <div>
                                    <label id={`guarantor_${i}_address_proof`} style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Address Proof (e.g. utility bill) *</label>
                                    <input type="file" accept="image/*" className="glass-input" style={{ borderColor: validationErrors[`guarantor_${i}_address_proof`] ? 'var(--accent-rose)' : '', borderWidth: validationErrors[`guarantor_${i}_address_proof`] ? '2px' : '' }} onChange={e => { handleGuarantorAddressProofChange(i, e); clearFieldError(`guarantor_${i}_address_proof`); }} />
                                    {g.address_proof && (
                                      <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <img src={g.address_proof} alt="Guarantor address proof preview" style={{ width: '45px', height: '30px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-glass)' }} />
                                        <span style={{ fontSize: '11px', color: 'var(--accent-emerald)' }}><CircleCheck className="icon" /> Photo Attached</span>
                                      </div>
                                    )}
                                    {validationErrors[`guarantor_${i}_address_proof`] && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors[`guarantor_${i}_address_proof`]}</span>}
                                  </div>

                                  <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Phone Number *</label>
                                    <input id={`guarantor_${i}_phone`} type="tel" className="glass-input" style={{ borderColor: validationErrors[`guarantor_${i}_phone`] ? 'var(--accent-rose)' : '', borderWidth: validationErrors[`guarantor_${i}_phone`] ? '2px' : '' }} value={g.phone} onChange={e => { updateGuarantorField(i, 'phone', e.target.value); clearFieldError(`guarantor_${i}_phone`); }} />
                                    {validationErrors[`guarantor_${i}_phone`] && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors[`guarantor_${i}_phone`]}</span>}
                                  </div>

                                  <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Address *</label>
                                    <input id={`guarantor_${i}_address`} type="text" className="glass-input" style={{ borderColor: validationErrors[`guarantor_${i}_address`] ? 'var(--accent-rose)' : '', borderWidth: validationErrors[`guarantor_${i}_address`] ? '2px' : '' }} value={g.address} onChange={e => { updateGuarantorField(i, 'address', e.target.value); clearFieldError(`guarantor_${i}_address`); }} />
                                    {validationErrors[`guarantor_${i}_address`] && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: '500' }}>{validationErrors[`guarantor_${i}_address`]}</span>}
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                      <input type="checkbox" checked={g.protected_under_debt_act} onChange={e => updateGuarantorField(i, 'protected_under_debt_act', e.target.checked)} />
                                      Protected under the state debt recovery act or any other law?
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                      <input type="checkbox" checked={g.has_pending_court_cases} onChange={e => updateGuarantorField(i, 'has_pending_court_cases', e.target.checked)} />
                                      Any court judgments/cases registered against them?
                                    </label>
                                  </div>

                                  <div>
                                    <p style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>Monthly Income (LKR)</p>
                                    <div className="form-grid-3-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                      <input type="number" min="0" className="glass-input" placeholder="Business" value={g.monthly_income_business} onChange={e => updateGuarantorField(i, 'monthly_income_business', e.target.value)} />
                                      <input type="number" min="0" className="glass-input" placeholder="Agriculture" value={g.monthly_income_agriculture} onChange={e => updateGuarantorField(i, 'monthly_income_agriculture', e.target.value)} />
                                      <input type="number" min="0" className="glass-input" placeholder="Other" value={g.monthly_income_other} onChange={e => updateGuarantorField(i, 'monthly_income_other', e.target.value)} />
                                    </div>
                                  </div>

                                  <div>
                                    <p style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>Monthly Expense (LKR)</p>
                                    <div className="form-grid-3-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                      <input type="number" min="0" className="glass-input" placeholder="Food" value={g.monthly_expense_food} onChange={e => updateGuarantorField(i, 'monthly_expense_food', e.target.value)} />
                                      <input type="number" min="0" className="glass-input" placeholder="House Rent" value={g.monthly_expense_rent} onChange={e => updateGuarantorField(i, 'monthly_expense_rent', e.target.value)} />
                                      <input type="number" min="0" className="glass-input" placeholder="Other" value={g.monthly_expense_other} onChange={e => updateGuarantorField(i, 'monthly_expense_other', e.target.value)} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}

                            <div style={{ display: 'flex', gap: '12px' }}>
                              <button type="button" className="glass-btn glass-btn-secondary" onClick={() => handleWizardBack(4)} style={{ flex: 1, padding: '16px' }}>Back</button>
                              <button type="submit" className="glass-btn glass-btn-emerald" disabled={loading} style={{ flex: 2, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                {user.role === 'agent' ? <><ClipboardCheck className="icon" /> Submit for Approval</> : 'Disburse Cash Loan'}
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

        {/* ----------------- AGENT DASHBOARD ----------------- */}
        {token && user && user.role === 'agent' && view === 'dashboard' && agentData && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {agentSubView === 'next-day-tasklist' && (
              <NextDayTasklistTab loans={agentData.assignedLoans} onNavigateRecordPayment={() => setAgentSubView('record-payment')} />
            )}
            
            {agentSubView === 'record-payment' && (
              <RecordDailyPaymentsTab loans={agentData.assignedLoans} onRefresh={fetchDashboardData} showToast={showToast} />
            )}
            
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

                {/* Mobile-only switcher: below 768px the two panels below stack
                    into one long scroll, so let the agent jump straight to
                    whichever one they need instead of scrolling past both
                    every time. No effect on desktop, which keeps showing
                    both panels side by side. */}
                <div className="mobile-only" style={{ display: 'flex', gap: '8px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                  <button type="button"
                    className={`glass-btn ${agentCollectMobileTab === 'form' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
                    style={{ flex: 1, padding: '8px', fontSize: '13px', border: 'none' }}
                    onClick={() => setAgentCollectMobileTab('form')}>
                    <Banknote className="icon" /> Record Payment
                  </button>
                  <button type="button"
                    className={`glass-btn ${agentCollectMobileTab === 'customers' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
                    style={{ flex: 1, padding: '8px', fontSize: '13px', border: 'none' }}
                    onClick={() => setAgentCollectMobileTab('customers')}>
                    <ClipboardCheck className="icon" /> My Customers
                  </button>
                </div>

                {/* Quick entry for agent collection */}
                <div className="responsive-grid-2-col">

                  {/* Collection Submission Form */}
                  <div className={`glass-card agent-collect-panel ${agentCollectMobileTab === 'form' ? 'active' : ''}`}>
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

                  {/* My Customers — Pending / Active / Defaulted / Closed / Rejected */}
                  <div className={`glass-card agent-collect-panel ${agentCollectMobileTab === 'customers' ? 'active' : ''}`}>
                    <h3 style={{ fontSize: '24px', marginBottom: '12px' }}><ClipboardCheck className="icon" /> My Customers</h3>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                      {['pending', 'active', 'defaulted', 'closed', 'rejected'].map(tab => {
                        const count = agentData.assignedLoans.filter(l => tab === 'closed' ? ['fully_paid', 'written_off'].includes(l.status) : l.status === tab).length;
                        return (
                          <button key={tab} type="button"
                            className={`glass-btn ${agentCustomerTab === tab ? (tab === 'pending' ? 'glass-btn-amber' : tab === 'rejected' ? 'glass-btn-secondary' : 'glass-btn-emerald') : 'glass-btn-secondary'}`}
                            style={{ padding: '6px 14px', fontSize: '12px', textTransform: 'capitalize' }}
                            onClick={() => setAgentCustomerTab(tab)}>
                            {tab === 'pending' ? 'Pending Approval' : tab} ({count})
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
                                      <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }} onClick={() => { resetPaymentForm(loan.id); setAgentCollectMobileTab('form'); }}>
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

              {/* Pending approval banner — the whole point of this loan
                  file view (all the tabs below: Passbook, Borrower Profile,
                  Guarantor Info) is that admin can review every detail an
                  agent submitted before deciding, so the approve/reject
                  actions live right here at the top rather than buried in a
                  separate review screen. */}
              {loanStatement.loan.status === 'pending' && (
                <div className="glass-card" style={{ border: '2px solid var(--accent-amber, #d97706)', background: 'var(--accent-blue-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Clock className="icon" style={{ width: '28px', height: '28px', color: '#b45309' }} />
                      <div>
                        <h3 style={{ fontSize: '18px', margin: 0 }}>Pending Approval</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                          {loanStatement.loan.agent_name ? `Submitted by ${loanStatement.loan.agent_name}. ` : ''}
                          No cash has been disbursed yet — review the details below before deciding.
                        </p>
                      </div>
                    </div>
                    {user.role === 'admin' && (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="glass-btn glass-btn-emerald" onClick={handleApproveLoan} disabled={loading}>
                          <ThumbsUp className="icon" /> Approve
                        </button>
                        <button className="glass-btn glass-btn-rose" onClick={handleRejectLoan} disabled={loading}>
                          <ThumbsDown className="icon" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {loanStatement.loan.status === 'rejected' && (
                <div className="glass-card" style={{ border: '2px solid var(--accent-rose)', background: 'rgba(239, 68, 68, 0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Ban className="icon" style={{ width: '28px', height: '28px', color: 'var(--accent-rose)' }} />
                    <div>
                      <h3 style={{ fontSize: '18px', margin: 0 }}>Application Rejected</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        Reason: {loanStatement.loan.loan_rejection_reason || 'No reason recorded.'}
                        {loanStatement.loan.rejected_at && ` — ${new Date(loanStatement.loan.rejected_at).toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Header info card */}
              <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 'bold', letterSpacing: '0.05em' }}>LOAN STATEMENT & HISTORY</span>
                  <h2 style={{ fontSize: '28px', margin: '4px 0', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    Loan Details: {loanStatement.loan.borrower_name}
                    {loanStatement.loan.reference_number && (
                      <span style={{ fontSize: '16px', color: 'var(--accent-blue)', background: 'rgba(59, 130, 246, 0.1)', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold' }}>
                        {loanStatement.loan.reference_number}
                      </span>
                    )}
                  </h2>
                  
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
                    <FileText className="icon" /> View Agreement
                  </button>
                  <button className="glass-btn" style={{ flex: 1, minWidth: '160px', padding: '10px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={handleDownloadAgreement} disabled={downloadingAgreement}>
                    <Download className="icon" /> {downloadingAgreement ? 'Generating...' : 'Download PDF'}
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
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {loanStatement.loan.collection_mode === 'fixed_term' && loanStatement.loan.maturity_date && (
                    <div className="glass-card">
                      <h3 style={{ fontSize: '18px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp className="icon" /> Fixed Term Progress</h3>
                      {(() => {
                        const start = new Date(loanStatement.loan.created_at);
                        const maturity = new Date(loanStatement.loan.maturity_date);
                        const today = new Date();
                        
                        const totalDays = Math.max(1, Math.round((maturity - start) / (1000 * 60 * 60 * 24)));
                        const elapsedDays = Math.max(0, Math.round((today - start) / (1000 * 60 * 60 * 24)));
                        const percent = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
                        
                        return (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                              <span>Disbursed: <strong>{start.toLocaleDateString()}</strong></span>
                              <span>Day {Math.min(totalDays, elapsedDays)} of {totalDays} ({percent.toFixed(0)}%)</span>
                              <span>Maturity: <strong>{maturity.toLocaleDateString()}</strong></span>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: 'var(--border-light)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${percent}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-emerald))', transition: 'width 0.4s ease' }} />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Mobile Sub-Tab Pills */}
                  <div className="mobile-only subtab-pill-bar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '8px' }}>
                    {(user.role === 'admin' || user.role === 'agent') && loanStatement.loan.status === 'active' && (
                      <button
                        type="button"
                        className={`subtab-pill ${passbookMobileTab === 'record' ? 'active' : ''}`}
                        onClick={() => setPassbookMobileTab('record')}
                      >
                        <Plus style={{ width: '14px', height: '14px' }} /> Record Payment
                      </button>
                    )}
                    <button
                      type="button"
                      className={`subtab-pill ${passbookMobileTab === 'activity' ? 'active' : ''}`}
                      onClick={() => setPassbookMobileTab('activity')}
                    >
                      <Receipt style={{ width: '14px', height: '14px' }} /> Activity Log ({displayEvents.length})
                    </button>
                    <button
                      type="button"
                      className={`subtab-pill ${passbookMobileTab === 'receipts' ? 'active' : ''}`}
                      onClick={() => setPassbookMobileTab('receipts')}
                    >
                      <Banknote style={{ width: '14px', height: '14px' }} /> Receipts ({loanStatement.payments.length})
                    </button>
                    <button
                      type="button"
                      className={`subtab-pill ${passbookMobileTab === 'accruals' ? 'active' : ''}`}
                      onClick={() => setPassbookMobileTab('accruals')}
                    >
                      <TrendingUp style={{ width: '14px', height: '14px' }} /> Interest Log ({loanStatement.accruals.length})
                    </button>
                  </div>

                  <div className="responsive-grid-2-col" style={{ gap: '24px' }}>
                    {/* Passbook Statement History */}
                    <div className={`glass-card ${passbookMobileTab !== 'activity' ? 'mobile-hidden' : ''}`} style={{ cursor: 'pointer', transition: 'transform 0.2s ease, border-color 0.2s ease' }} onClick={() => setView('passbook-details')}>
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
                        <div className={`glass-card ${passbookMobileTab !== 'record' ? 'mobile-hidden' : ''}`} onClick={(e) => e.stopPropagation()} style={{ border: '1px solid var(--border-light)', background: 'rgba(255, 255, 255, 0.01)' }}>
                          <h3 style={{ fontSize: '18px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Banknote className="icon" style={{ color: 'var(--accent-blue)' }} /> Record a Payment
                          </h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '14px' }}>
                            Enter cash collection details for this loan.
                          </p>
                          <form onSubmit={handleLedgerCollectPayment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>PAYMENT TYPE</label>
                              {loanStatement.loan.is_flat_installment ? (
                                <div className="glass-btn glass-btn-emerald" style={{ width: '100%', padding: '8px 12px', fontSize: '12px', textAlign: 'center', cursor: 'default' }}>
                                  Principal + Interest (Flat Installment)
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button type="button"
                                    className={`glass-btn ${ledgerPaymentForm.payment_type === 'interest' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
                                    style={{ flex: 1, padding: '8px 12px', fontSize: '12px' }}
                                    onClick={() => setLedgerPaymentForm(prev => ({ ...prev, payment_type: 'interest' }))}>
                                    Interest
                                  </button>
                                  <button type="button"
                                    className={`glass-btn ${ledgerPaymentForm.payment_type === 'principal' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
                                    style={{ flex: 1, padding: '8px 12px', fontSize: '12px' }}
                                    onClick={() => setLedgerPaymentForm(prev => ({ ...prev, payment_type: 'principal' }))}>
                                    Principal
                                  </button>
                                </div>
                              )}
                              {loanStatement.loan.is_flat_installment && (
                                <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>
                                  Daily installment due: LKR {parseFloat(loanStatement.loan.daily_installment_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                              )}
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>AMOUNT (LKR) *</label>
                              <input required type="number" inputMode="decimal" step="0.01" min="0.01" className="glass-input" placeholder="0.00"
                                value={ledgerPaymentForm.amount}
                                onChange={e => setLedgerPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                                style={{ padding: '10px 12px', fontSize: '16px', fontWeight: 'bold' }} />
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

                            <button type="submit" className="glass-btn glass-btn-emerald" disabled={loading} style={{ width: '100%', padding: '12px', fontSize: '15px', marginTop: '4px' }}>
                              Collect Payment
                            </button>
                          </form>
                        </div>
                      )}

                      {/* Collection Receipts ledger */}
                      <div className={`glass-card ${passbookMobileTab !== 'receipts' ? 'mobile-hidden' : ''}`}>
                        <h3 style={{ fontSize: '18px', marginBottom: '14px' }}><Banknote className="icon" /> Payments Received</h3>
                        {loanStatement.payments.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No payments collected yet.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                            {loanStatement.payments.map((p, idx) => (
                              <div key={idx} style={{ padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                                  <span>Received by <strong>{p.agent_name || 'Office'}</strong></span>
                                  <span style={{ color: 'var(--text-muted)' }}>{new Date(p.payment_date).toLocaleDateString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                  <strong style={{ color: 'var(--accent-emerald)', fontSize: '15px' }}>LKR {parseFloat(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button type="button" className="glass-btn btn-whatsapp" style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '6px', backgroundColor: '#25D366', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }} onClick={() => {
                                      handleShareWhatsAppReceipt({
                                        ...p,
                                        borrower_name: loanStatement.loan.borrower_name,
                                        borrower_phone: loanStatement.loan.borrower_phone,
                                        loan_principal: loanStatement.loan.principal_amount,
                                        loan_interest_rate: loanStatement.loan.interest_rate,
                                        loan_interest_type: loanStatement.loan.interest_type,
                                        loan_principal_outstanding: loanStatement.loan.principal_outstanding,
                                        loan_interest_balance: loanStatement.loan.interest_balance
                                      });
                                    }}>
                                      <MessageSquare className="icon" style={{ width: '12px', height: '12px' }} /> WhatsApp
                                    </button>
                                    <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '6px' }} onClick={() => {
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
                                  </div>
                                </div>
                                {p.notes && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>"{p.notes}"</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Accrued Interest list */}
                      <div className={`glass-card ${passbookMobileTab !== 'accruals' ? 'mobile-hidden' : ''}`}>
                        <h3 style={{ fontSize: '18px', marginBottom: '14px' }}><TrendingUp className="icon" /> Interest Charged History</h3>
                        {loanStatement.accruals.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No interest accrued yet.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                            {loanStatement.accruals.map((acc, idx) => (
                              <div key={idx} style={{ padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                  <span>Accrued Date</span>
                                  <span>{new Date(acc.created_at).toLocaleDateString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <strong style={{ color: 'var(--accent-gold)' }}>+ LKR {parseFloat(acc.amount_accrued).toLocaleString()}</strong>
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
                        <div><strong>Date of Birth:</strong> {loanStatement.loan.date_of_birth ? new Date(loanStatement.loan.date_of_birth).toLocaleDateString() : '-'}</div>
                        <div style={{ gridColumn: '1 / -1' }}><strong>Purpose of Loan:</strong> {loanStatement.loan.loan_purpose || '-'}</div>
                        <div><strong>Dependents:</strong> {loanStatement.loan.dependents_count ?? '-'}</div>
                        <div><strong>Monthly Income:</strong> {loanStatement.loan.monthly_income !== null && loanStatement.loan.monthly_income !== undefined ? `LKR ${parseFloat(loanStatement.loan.monthly_income).toLocaleString()}` : '-'}</div>
                        <div><strong>Spouse Name:</strong> {loanStatement.loan.spouse_name || '-'}</div>
                        <div><strong>Spouse NIC:</strong> {loanStatement.loan.spouse_nic || '-'}</div>
                        <div style={{ gridColumn: '1 / -1' }}><strong>Spouse Occupation:</strong> {loanStatement.loan.spouse_occupation || '-'}</div>
                      </div>
                      {loanStatement.loan.address_proof_url && (
                        <div style={{ marginTop: '14px' }}>
                          <strong style={{ display: 'block', marginBottom: '6px', fontSize: '13px' }}>Address Proof:</strong>
                          <img src={loanStatement.loan.address_proof_url} alt="Borrower address proof" style={{ width: '160px', height: '105px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-glass)' }} />
                        </div>
                      )}
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
                  {(loanStatement.guarantors || []).map((gtor, gi) => (
                    <div className="glass-card" key={gtor.id || gi}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '22px', margin: 0 }}><ShieldCheck className="icon" /> Guarantor Details {loanStatement.guarantors.length > 1 ? `(${gi + 1} of ${loanStatement.guarantors.length})` : ''}</h3>
                        {/* Edit/Remove only supported for a single-guarantor loan — the
                            underlying API operates on "the" guarantor for a loan_id and
                            can't disambiguate between several. */}
                        {user.role === 'admin' && loanStatement.guarantors.length === 1 && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }} onClick={() => handleOpenGuarantorEditor(gtor)}>
                              Edit Guarantor
                            </button>
                            <button className="glass-btn glass-btn-rose" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }} onClick={handleRemoveGuarantor}>
                              <Trash2 className="icon" /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        {gtor.nic_photo_url && (
                          <div>
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>NIC Photo</span>
                            <img src={gtor.nic_photo_url} alt={`${gtor.full_name} NIC`} style={{ width: '110px', height: '72px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-glass)' }} />
                          </div>
                        )}
                        {gtor.address_proof_url && (
                          <div>
                            <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>Address Proof</span>
                            <img src={gtor.address_proof_url} alt={`${gtor.full_name} address proof`} style={{ width: '110px', height: '72px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-glass)' }} />
                          </div>
                        )}
                      </div>
                      <div className="responsive-grid-2-col" style={{ rowGap: '10px' }}>
                        <div><strong>Name:</strong> {gtor.full_name}</div>
                        <div><strong>NIC:</strong> {gtor.nic_number}</div>
                        <div><strong>Phone:</strong> {gtor.phone}</div>
                        <div style={{ gridColumn: '1 / -1' }}><strong>Address:</strong> {gtor.address}</div>
                        <div>
                          <strong>Protected under debt-recovery act:</strong>{' '}
                          <span style={{ color: gtor.protected_under_debt_act ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                            {gtor.protected_under_debt_act ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div>
                          <strong>Pending court cases:</strong>{' '}
                          <span style={{ color: gtor.has_pending_court_cases ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                            {gtor.has_pending_court_cases ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                      <div style={{ marginTop: '14px', display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '14px' }}>
                        <div>
                          <strong>Monthly Income:</strong> LKR {(
                            parseFloat(gtor.monthly_income_business || 0) +
                            parseFloat(gtor.monthly_income_agriculture || 0) +
                            parseFloat(gtor.monthly_income_other || 0)
                          ).toLocaleString()}
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}> (Business: {parseFloat(gtor.monthly_income_business || 0).toLocaleString()}, Agriculture: {parseFloat(gtor.monthly_income_agriculture || 0).toLocaleString()}, Other: {parseFloat(gtor.monthly_income_other || 0).toLocaleString()})</span>
                        </div>
                        <div>
                          <strong>Monthly Expense:</strong> LKR {(
                            parseFloat(gtor.monthly_expense_food || 0) +
                            parseFloat(gtor.monthly_expense_rent || 0) +
                            parseFloat(gtor.monthly_expense_other || 0)
                          ).toLocaleString()}
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}> (Food: {parseFloat(gtor.monthly_expense_food || 0).toLocaleString()}, Rent: {parseFloat(gtor.monthly_expense_rent || 0).toLocaleString()}, Other: {parseFloat(gtor.monthly_expense_other || 0).toLocaleString()})</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {(!loanStatement.guarantors || loanStatement.guarantors.length === 0) && user.role === 'admin' && (
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
      {token && user && view !== 'portal' && view !== 'ticket-dashboard' && (
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
              <button className={`bottom-nav-item ${view === 'create-loan' ? 'active' : ''}`} onClick={() => { setView('create-loan'); setGiveLoanStep(1); }}>
                <span className="bottom-nav-icon"><Plus /></span>
                <span className="bottom-nav-label">Give Loan</span>
              </button>
              <button className={`bottom-nav-item ${view === 'dashboard' && agentSubView === 'collect' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setAgentSubView('collect'); }}>
                <span className="bottom-nav-icon"><Banknote /></span>
                <span className="bottom-nav-label">Collect</span>
              </button>
              <button className={`bottom-nav-item ${view === 'dashboard' && agentSubView === 'record-payment' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setAgentSubView('record-payment'); }}>
                <span className="bottom-nav-icon"><CreditCard /></span>
                <span className="bottom-nav-label">Record</span>
              </button>
              <button className={`bottom-nav-item ${view === 'dashboard' && agentSubView === 'history' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setAgentSubView('history'); }}>
                <span className="bottom-nav-icon"><ScrollText /></span>
                <span className="bottom-nav-label">History</span>
              </button>
              <button className={`bottom-nav-item ${view === 'dashboard' && agentSubView === 'remit' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setAgentSubView('remit'); }}>
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

// Shimmering placeholder cards shown while a list-style loader is fetching —
// referenced by LoansLoader, AuditLogLoader, and PaymentHistoryLoader below.
function SkeletonCards({ count = 3, lines = 2 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          {Array.from({ length: lines }).map((__, j) => (
            <span key={j} className="skeleton skeleton-line" />
          ))}
        </div>
      ))}
    </>
  );
}

function LoansLoader({ onSelect, fetchTrigger }) {
  const [loans, setLoans] = useState([]);
  const [agents, setAgents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/loans'),
      api.get('/users/agents').catch(() => [])
    ])
      .then(([loansData, agentsData]) => {
        setLoans(Array.isArray(loansData) ? loansData : []);
        setAgents(Array.isArray(agentsData) ? agentsData : []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [fetchTrigger]);

  useEffect(() => { setPage(1); }, [searchTerm, statusFilter, typeFilter, agentFilter, fromDate, toDate, fetchTrigger]);

  const clearAllFilters = () => {
    setSearchTerm(''); setStatusFilter('all'); setTypeFilter('all');
    setAgentFilter('all'); setFromDate(''); setToDate('');
  };

  if (loading) return <div className="glass-card" style={{ marginTop: '24px' }}><SkeletonCards count={4} lines={2} /></div>;

  const filteredLoans = loans.filter(loan => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch = !q ||
      loan.borrower_name.toLowerCase().includes(q) ||
      loan.borrower_phone.includes(q) ||
      (loan.nic_number && loan.nic_number.toLowerCase().includes(q)) ||
      (loan.reference_number && loan.reference_number.toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'all' || loan.status === statusFilter;
    const matchesType = typeFilter === 'all' || loan.interest_type === typeFilter;
    const matchesAgent = agentFilter === 'all' || String(loan.assigned_agent_id) === String(agentFilter);
    let matchesDate = true;
    if (fromDate) matchesDate = matchesDate && new Date(loan.created_at) >= new Date(fromDate);
    if (toDate) { const e = new Date(toDate); e.setHours(23,59,59,999); matchesDate = matchesDate && new Date(loan.created_at) <= e; }
    return matchesSearch && matchesStatus && matchesType && matchesAgent && matchesDate;
  });

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || agentFilter !== 'all' || fromDate || toDate;
  const totalPages = Math.max(1, Math.ceil(filteredLoans.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedLoans = filteredLoans.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleExportCsv = () => {
    downloadCsv(
      `loans-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date Given', 'Borrower', 'Phone', 'NIC', 'Principal', 'Interest Type', 'Rate %', 'Principal Outstanding', 'Interest Due', 'Agent', 'Status'],
      filteredLoans.map(loan => [
        new Date(loan.created_at).toLocaleDateString(), loan.borrower_name, loan.borrower_phone,
        loan.nic_number || '', parseFloat(loan.principal_amount).toFixed(2), loan.interest_type,
        loan.interest_rate, parseFloat(loan.principal_outstanding).toFixed(2),
        parseFloat(loan.interest_balance).toFixed(2), loan.agent_name || 'Self-Collect', loan.status
      ])
    );
  };

  const totalPrincipal = filteredLoans.reduce((s, l) => s + (parseFloat(l.principal_amount) || 0), 0);
  const totalOutstanding = filteredLoans.reduce((s, l) => s + (parseFloat(l.principal_outstanding) || 0), 0);
  const totalInterest = filteredLoans.reduce((s, l) => s + (parseFloat(l.interest_balance) || 0), 0);
  const activeCount = filteredLoans.filter(l => l.status === 'active').length;
  const paidCount = filteredLoans.filter(l => l.status === 'fully_paid').length;
  const typeColor = { daily: 'var(--accent-blue)', weekly: 'var(--accent-amber)', monthly: 'var(--accent-emerald)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '8px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <ClipboardList style={{ color: 'var(--accent-blue)', width: '28px', height: '28px' }} />
            Loan Directory
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            {hasActiveFilters
              ? <><strong style={{ color: 'var(--accent-blue)' }}>{filteredLoans.length}</strong> of {loans.length} loans match your filters</>
              : <><strong style={{ color: 'var(--text-primary)' }}>{loans.length}</strong> total loan accounts</>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {hasActiveFilters && (
            <button type="button" className="glass-btn glass-btn-rose" style={{ padding: '8px 16px', fontSize: '12px', fontWeight: '700' }} onClick={clearAllFilters}>
              <RefreshCcw className="icon" /> Clear Filters
            </button>
          )}
          <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={handleExportCsv} disabled={filteredLoans.length === 0}>
            <Download className="icon" /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Total Disbursed', val: `LKR ${Math.round(totalPrincipal).toLocaleString()}`, color: 'var(--accent-blue)', icon: '💰' },
          { label: 'Principal Outstanding', val: `LKR ${Math.round(totalOutstanding).toLocaleString()}`, color: 'var(--accent-rose)', icon: '📊' },
          { label: 'Interest Due', val: `LKR ${Math.round(totalInterest).toLocaleString()}`, color: 'var(--accent-amber)', icon: '📈' },
          { label: 'Active / Unpaid', val: activeCount, color: 'var(--accent-emerald)', icon: '🟢' },
          { label: 'Fully Paid', val: paidCount, color: 'var(--text-secondary)', icon: '✅' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '14px 16px' }}>
            <span style={{ fontSize: '18px' }}>{k.icon}</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginTop: '4px' }}>{k.label}</span>
            <span style={{ fontSize: '18px', fontWeight: '800', color: k.color, display: 'block' }}>{k.val}</span>
          </div>
        ))}
      </div>

      {/* Filter Panel */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input type="text" className="glass-input" placeholder="Search name, phone, NIC, code…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '32px', fontSize: '13px', width: '100%' }} />
          </div>
          <button
            type="button"
            className={`glass-btn ${hasActiveFilters ? 'glass-btn-blue' : 'glass-btn-secondary'} mobile-only`}
            style={{ padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setShowMobileFilters(!showMobileFilters)}
          >
            <Filter className="icon" style={{ width: '14px', height: '14px' }} />
            Filters {hasActiveFilters && '•'}
          </button>
        </div>

        {/* Collapsible Filters Drawer for Mobile, always visible on Desktop */}
        <div className={`${!showMobileFilters ? 'mobile-hidden' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '14px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>📅 From Date</label>
              <input type="date" className="glass-input" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ fontSize: '13px', width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>📅 To Date</label>
              <input type="date" className="glass-input" value={toDate} onChange={e => setToDate(e.target.value)} style={{ fontSize: '13px', width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>🔄 Collection Type</label>
              <select className="glass-input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ fontSize: '13px', width: '100%' }}>
                <option value="all">All Types</option>
                <option value="daily">Daily Collection</option>
                <option value="weekly">Weekly Collection</option>
                <option value="monthly">Monthly Collection</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>👤 Assigned Agent</label>
              <select className="glass-input" value={agentFilter} onChange={e => setAgentFilter(e.target.value)} style={{ fontSize: '13px', width: '100%' }}>
                <option value="all">All Agents</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status:</span>
            {[
              { val: 'all', label: `All (${loans.length})`, activeClass: 'glass-btn-blue' },
              { val: 'pending', label: `Pending Approval (${loans.filter(l => l.status === 'pending').length})`, activeClass: 'glass-btn-amber' },
              { val: 'active', label: `Active (${loans.filter(l => l.status === 'active').length})`, activeClass: 'glass-btn-emerald' },
              { val: 'fully_paid', label: `Paid (${loans.filter(l => l.status === 'fully_paid').length})`, activeClass: 'glass-btn-secondary' },
              { val: 'defaulted', label: `Defaulted (${loans.filter(l => l.status === 'defaulted').length})`, activeClass: 'glass-btn-rose' },
              { val: 'rejected', label: `Rejected (${loans.filter(l => l.status === 'rejected').length})`, activeClass: 'glass-btn-secondary' },
            ].map(f => (
              <button key={f.val} type="button"
                className={`glass-btn ${statusFilter === f.val ? f.activeClass : 'glass-btn-secondary'}`}
                style={{ padding: '5px 14px', fontSize: '12px', fontWeight: statusFilter === f.val ? '700' : '500' }}
                onClick={() => setStatusFilter(f.val)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active:</span>
            {searchTerm && <span style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-blue)', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>"{searchTerm}"</span>}
            {statusFilter !== 'all' && <span style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--accent-emerald)', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{statusFilter}</span>}
            {typeFilter !== 'all' && <span style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--accent-amber)', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{typeFilter}</span>}
            {agentFilter !== 'all' && <span style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{agents.find(a => String(a.id) === agentFilter)?.name || 'Agent'}</span>}
            {fromDate && <span style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>From {fromDate}</span>}
            {toDate && <span style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>To {toDate}</span>}
          </div>
        )}
      </div>

      {filteredLoans.length === 0 ? (
        <div className="glass-card">
          <div className="empty-state">
            <div className="empty-state-icon"><Search style={{ width: '28px', height: '28px' }} /></div>
            <h4 className="empty-state-title">No Matching Loans Found</h4>
            <p className="empty-state-text">{hasActiveFilters ? 'No loans match your current filters. Try clearing or adjusting them.' : 'No loan accounts exist yet.'}</p>
            {hasActiveFilters && <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '8px 18px', fontSize: '13px' }} onClick={clearAllFilters}><RefreshCcw className="icon" /> Clear All Filters</button>}
          </div>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="desktop-only" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '2px solid var(--border-light)' }}>
                  {['Date Given', 'Borrower', 'Amount', 'Type', 'Rate', 'Principal Due', 'Interest Due', 'Agent', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedLoans.map((loan, i) => {
                  const isActive = loan.status === 'active';
                  const isPaid = loan.status === 'fully_paid';
                  const isPending = loan.status === 'pending';
                  const isRejected = loan.status === 'rejected';
                  return (
                    <tr key={loan.id}
                      style={{ borderBottom: '1px solid var(--border-light)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'}
                      onClick={() => onSelect(loan.id)}>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '12px' }}>{new Date(loan.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <strong style={{ display: 'block', fontSize: '13px' }}>{loan.borrower_name}</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <span><Phone className="icon" style={{ width: '12px', height: '12px' }} /> {loan.borrower_phone}</span>
                          <span className="quick-contact-actions" onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px' }}>
                            <a href={`tel:${loan.borrower_phone}`} className="quick-contact-btn phone" title="Call Customer" style={{ color: 'var(--accent-blue)' }}>
                              <Phone style={{ width: '11px', height: '11px' }} />
                            </a>
                            <a href={`https://wa.me/${(loan.borrower_phone || '').replace(/[^0-9]/g, '').startsWith('0') ? '94' + (loan.borrower_phone || '').replace(/[^0-9]/g, '').slice(1) : (loan.borrower_phone || '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="quick-contact-btn whatsapp" title="Chat on WhatsApp" style={{ color: '#25D366' }}>
                              <MessageSquare style={{ width: '11px', height: '11px' }} />
                            </a>
                          </span>
                        </div>
                        {loan.nic_number && <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}><IdCard className="icon" /> {loan.nic_number}</span>}
                        {loan.reference_number && <span style={{ fontSize: '10px', background: 'rgba(59,130,246,0.12)', color: 'var(--accent-blue)', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '2px' }}>{loan.reference_number}</span>}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: '700', whiteSpace: 'nowrap' }}>LKR {parseFloat(loan.principal_amount).toLocaleString()}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: (typeColor[loan.interest_type] || '#666') + '22', color: typeColor[loan.interest_type] || 'var(--text-secondary)', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                          {loan.interest_type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{loan.interest_rate}%</td>
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: parseFloat(loan.principal_outstanding) > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', whiteSpace: 'nowrap' }}>
                        {parseFloat(loan.principal_outstanding) > 0 ? `LKR ${parseFloat(loan.principal_outstanding).toLocaleString()}` : 'Settled'}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: parseFloat(loan.interest_balance) > 0 ? 'var(--accent-amber)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {parseFloat(loan.interest_balance) > 0 ? `LKR ${parseFloat(loan.interest_balance).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>{loan.agent_name || <em style={{ color: 'var(--text-muted)' }}>Office</em>}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span className={`status-pill ${isActive ? 'status-pill-active' : isPaid ? 'status-pill-paid' : isPending ? 'status-pill-pending' : isRejected ? 'status-pill-rejected' : 'status-pill-defaulted'}`}>
                          <span className="status-pill-dot" />{isActive ? 'Active' : isPaid ? 'Paid' : isPending ? 'Pending Approval' : isRejected ? 'Rejected' : loan.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <button className="glass-btn glass-btn-secondary" style={{ padding: '5px 12px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }} onClick={e => { e.stopPropagation(); onSelect(loan.id); }}>View &rarr;</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mobile-only" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pagedLoans.map(loan => {
              const isActive = loan.status === 'active';
              const isPaid = loan.status === 'fully_paid';
              const isPending = loan.status === 'pending';
              const isRejected = loan.status === 'rejected';
              const bc = isActive ? 'var(--accent-amber)' : isPaid ? 'var(--accent-emerald)' : isPending ? 'var(--accent-blue)' : isRejected ? 'var(--text-muted)' : 'var(--accent-rose)';
              return (
                <div key={loan.id} onClick={() => onSelect(loan.id)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '14px 16px', cursor: 'pointer', borderLeft: `4px solid ${bc}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '15px', display: 'block' }}>{loan.borrower_name}</strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><Phone className="icon" /> {loan.borrower_phone}</span>
                        <span className="quick-contact-actions" onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px' }}>
                          <a href={`tel:${loan.borrower_phone}`} className="quick-contact-btn phone" title="Call" style={{ color: 'var(--accent-blue)' }}>
                            <Phone style={{ width: '12px', height: '12px' }} />
                          </a>
                          <a href={`https://wa.me/${(loan.borrower_phone || '').replace(/[^0-9]/g, '').startsWith('0') ? '94' + (loan.borrower_phone || '').replace(/[^0-9]/g, '').slice(1) : (loan.borrower_phone || '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="quick-contact-btn whatsapp" title="WhatsApp" style={{ color: '#25D366' }}>
                            <MessageSquare style={{ width: '12px', height: '12px' }} />
                          </a>
                        </span>
                      </div>
                      {loan.nic_number && <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}><IdCard className="icon" /> {loan.nic_number}</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <span className={`status-pill ${isActive ? 'status-pill-active' : isPaid ? 'status-pill-paid' : isPending ? 'status-pill-pending' : isRejected ? 'status-pill-rejected' : 'status-pill-defaulted'}`}><span className="status-pill-dot" />{isActive ? 'Active' : isPaid ? 'Paid' : isPending ? 'Pending' : isRejected ? 'Rejected' : loan.status}</span>
                      <span style={{ background: (typeColor[loan.interest_type] || '#666') + '22', color: typeColor[loan.interest_type], padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', textTransform: 'capitalize' }}>{loan.interest_type}</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[['Principal', `LKR ${parseFloat(loan.principal_amount).toLocaleString()}`, null], ['Rate', `${loan.interest_rate}%`, null], ['Principal Due', `LKR ${parseFloat(loan.principal_outstanding).toLocaleString()}`, 'var(--accent-rose)'], ['Interest Due', `LKR ${parseFloat(loan.interest_balance).toLocaleString()}`, 'var(--accent-amber)']].map(([lbl, val, col]) => (
                      <div key={lbl} style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '8px' }}>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>{lbl}</span>
                        <span style={{ fontWeight: '700', fontSize: '12px', color: col || 'var(--text-primary)' }}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-light)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>{loan.agent_name || 'Office'} · {new Date(loan.created_at).toLocaleDateString()}</span>
                    <span style={{ color: 'var(--accent-blue)', fontWeight: '700' }}>View →</span>
                  </div>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', padding: '16px', borderTop: '1px solid var(--border-light)', flexWrap: 'wrap' }}>
              <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '7px 16px', fontSize: '12px' }} disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</button>
              <div style={{ display: 'flex', gap: '4px' }}>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                  <button key={p} type="button" onClick={() => setPage(p)} style={{ width: '32px', height: '32px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', background: currentPage === p ? 'var(--accent-blue)' : 'var(--bg-tertiary)', color: currentPage === p ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s' }}>{p}</button>
                ))}
              </div>
              <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '7px 16px', fontSize: '12px' }} disabled={currentPage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next →</button>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{filteredLoans.length} total</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// Full, paginated audit trail with multi-criteria filtering
function AuditLogLoader() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (search) params.set('search', search);
    if (actionType) params.set('actionType', actionType);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);

    api.get(`/audit-logs?${params.toString()}`)
      .then(res => setData(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [page, search, actionType, fromDate, toDate]);

  useEffect(() => {
    setPage(1);
  }, [search, actionType, fromDate, toDate]);

  const clearFilters = () => {
    setSearch('');
    setActionType('');
    setFromDate('');
    setToDate('');
  };

  const hasActiveFilters = search || actionType || fromDate || toDate;

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ScrollText className="icon" style={{ color: 'var(--accent-blue)' }} /> Audit Log
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {data ? `Showing page ${data.page} of ${data.totalPages} (${data.total} total log entries)` : 'System activity trail'}
          </span>
        </div>

        {hasActiveFilters && (
          <button type="button" className="glass-btn glass-btn-rose" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={clearFilters}>
            <RefreshCcw className="icon" /> Reset Filters
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div style={{ padding: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>SEARCH DESCRIPTION</label>
          <input
            type="text"
            className="glass-input"
            placeholder="Search description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '7px 10px', fontSize: '13px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>FROM DATE</label>
          <input
            type="date"
            className="glass-input"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            style={{ padding: '7px 10px', fontSize: '13px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>TO DATE</label>
          <input
            type="date"
            className="glass-input"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            style={{ padding: '7px 10px', fontSize: '13px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>ACTION TYPE</label>
          <select className="glass-input" style={{ padding: '7px 10px', fontSize: '13px' }} value={actionType} onChange={e => setActionType(e.target.value)}>
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
        <div className="empty-state">
          <div className="empty-state-icon"><Search style={{ width: '28px', height: '28px' }} /></div>
          <h4 className="empty-state-title">No Audit Log Entries Found</h4>
          <p className="empty-state-text">No audit actions match the current filter selection.</p>
        </div>
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

// Full, paginated payment history across all agents/borrowers with multi-criteria filters
function PaymentHistoryLoader() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentType, setPaymentType] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (search) params.set('search', search);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    if (paymentMethod) params.set('paymentMethod', paymentMethod);
    if (paymentType) params.set('paymentType', paymentType);

    api.get(`/payments/history?${params.toString()}`)
      .then(res => setData(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [page, search, fromDate, toDate, paymentMethod, paymentType]);

  useEffect(() => {
    setPage(1);
  }, [search, fromDate, toDate, paymentMethod, paymentType]);

  const clearFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setPaymentMethod('');
    setPaymentType('');
  };

  const hasActiveFilters = search || fromDate || toDate || paymentMethod || paymentType;

  const handleExportCsv = () => {
    if (!data) return;
    downloadCsv(
      `payment-history-page-${data.page}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Borrower', 'Agent', 'Type', 'Amount', 'Method', 'Security Code', 'Notes'],
      data.data.map(tx => [
        new Date(tx.payment_date).toLocaleString(),
        tx.borrower_name,
        tx.agent_name,
        tx.payment_type,
        parseFloat(tx.amount).toFixed(2),
        tx.payment_method,
        tx.idempotency_key || '',
        tx.notes || ''
      ])
    );
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt className="icon" style={{ color: 'var(--accent-blue)' }} /> Payment History Log
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {data ? `Showing page ${data.page} of ${data.totalPages} (${data.total} total payments)` : 'Transaction ledger'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="glass-btn glass-btn-secondary" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={handleExportCsv} disabled={!data || data.data.length === 0}>
            <Download className="icon" /> Export CSV ({data?.data?.length || 0})
          </button>
          {hasActiveFilters && (
            <button type="button" className="glass-btn glass-btn-rose" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={clearFilters}>
              <RefreshCcw className="icon" /> Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div style={{ padding: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>SEARCH (NAME / PHONE / NIC / CODE)</label>
          <input
            type="text"
            className="glass-input"
            placeholder="e.g. Bandara, 1990..., idemp..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '7px 10px', fontSize: '13px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>FROM DATE</label>
          <input
            type="date"
            className="glass-input"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            style={{ padding: '7px 10px', fontSize: '13px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>TO DATE</label>
          <input
            type="date"
            className="glass-input"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            style={{ padding: '7px 10px', fontSize: '13px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>PAYMENT METHOD</label>
          <select className="glass-input" style={{ padding: '7px 10px', fontSize: '13px' }} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
            <option value="">All Methods</option>
            <option value="cash">Cash Collection</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="mobile_wallet">Mobile Wallet</option>
            <option value="card">Card Payment</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>PAYMENT TYPE</label>
          <select className="glass-input" style={{ padding: '7px 10px', fontSize: '13px' }} value={paymentType} onChange={e => setPaymentType(e.target.value)}>
            <option value="">All Types</option>
            <option value="interest">Interest Payment</option>
            <option value="principal">Principal Repayment</option>
          </select>
        </div>
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
  // Flat installment loans have their full interest total booked upfront
  // (see recordFlatInstallmentCollection) — nothing accrues incrementally,
  // so the stored balance already IS the current balance.
  if (loan.is_flat_installment) return stored;
  if (loan.status !== 'active' || !loan.next_accrual_date) return stored;

  const principal = parseFloat(loan.principal_amount) || 0;
  const rate = parseFloat(loan.interest_rate) || 0;
  const monthlyInterest = principal * (rate / 100);
  let interestPerPeriod = monthlyInterest;
  if (loan.interest_type === 'daily') {
    interestPerPeriod = monthlyInterest / 30;
  } else if (loan.interest_type === 'weekly') {
    interestPerPeriod = monthlyInterest / 4;
  }
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

// Record Payment Component - Inline collection entry sheet, split into
// Daily / Weekly / Monthly tabs (matching the app's three interest_type
// values). Each row is: Loan ID, Name, Due, a "Full Due" checkbox, and a
// "Partial" checkbox that reveals a custom-amount box when ticked — the two
// are mutually exclusive, since a row is either paid in full or a specific
// partial amount. Renders as a compact table on desktop and as stacked
// cards on mobile (a 7-column table forced horizontal scrolling on phones,
// which is exactly the "uncomfortable to scroll" complaint this replaces).
function RecordDailyPaymentsTab({ loans = [], onRefresh, showToast }) {
  const [collectionType, setCollectionType] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState({});
  const [submittingIds, setSubmittingIds] = useState({});
  const [fetchedLoans, setFetchedLoans] = useState([]);
  const [loadingLoans, setLoadingLoans] = useState(false);

  useEffect(() => {
    if (!loans || loans.length === 0) {
      setLoadingLoans(true);
      api.get('/loans?status=active')
        .then(res => setFetchedLoans(Array.isArray(res) ? res : []))
        .catch(err => console.error('Fetch loans error:', err))
        .finally(() => setLoadingLoans(false));
    }
  }, [loans?.length]);

  const activeSource = (loans && loans.length > 0) ? loans : fetchedLoans;
  const typeLoans = activeSource.filter(l => l.status === 'active' && l.interest_type === collectionType);

  const filteredLoans = typeLoans.filter(l => {
    if (!searchTerm) return true;
    const term = searchTerm.trim().toLowerCase();
    return (
      (l.borrower_name || '').toLowerCase().includes(term) ||
      (l.borrower_phone || '').includes(term) ||
      (l.nic_number || '').toLowerCase().includes(term) ||
      (l.reference_number || '').toLowerCase().includes(term) ||
      String(l.id).includes(term)
    );
  });

  const periodDue = (loan) => {
    if (loan.is_flat_installment) return parseFloat(loan.daily_installment_amount) || 0;
    const monthlyInterest = (parseFloat(loan.principal_amount) || 0) * ((parseFloat(loan.interest_rate) || 0) / 100);
    if (loan.interest_type === 'daily') return monthlyInterest / 30;
    if (loan.interest_type === 'weekly') return monthlyInterest / 4;
    return monthlyInterest;
  };
  const periodLabel = { daily: '/day', weekly: '/week', monthly: '/month' }[collectionType];

  const updateRowField = (loanId, field, value) => {
    setSelectedRows(prev => {
      const current = prev[loanId] || { mode: null, amount: '', paymentType: 'interest' };
      return {
        ...prev,
        [loanId]: { ...current, [field]: value }
      };
    });
  };

  // mode is 'full' or 'partial' — the two checkboxes are mutually exclusive.
  const handleToggleMode = (loan, mode, checked) => {
    // Flat installment loans: "Full Due" means today's flat amount (which
    // covers a mix of principal + interest), not the whole remaining
    // interest_balance the way every other loan type works — the borrower
    // isn't expected to pay off the entire remaining term in one day.
    const totalDue = loan.is_flat_installment
      ? Math.min(periodDue(loan), parseFloat(loan.principal_outstanding) + parseFloat(loan.interest_balance))
      : (parseFloat(loan.interest_balance) > 0 ? parseFloat(loan.interest_balance) : periodDue(loan));

    setSelectedRows(prev => {
      const current = prev[loan.id] || { paymentType: 'interest' };
      if (!checked) {
        return { ...prev, [loan.id]: { ...current, mode: null, amount: '' } };
      }
      return {
        ...prev,
        [loan.id]: {
          ...current,
          mode,
          amount: mode === 'full' ? Math.round(totalDue).toString() : ''
        }
      };
    });
  };

  const handleSavePaymentRow = async (loan) => {
    const row = selectedRows[loan.id] || {};
    const amountVal = parseFloat(row.amount);
    if (!amountVal || amountVal <= 0) {
      if (showToast) showToast('Please enter a valid payment amount.');
      return;
    }

    const paymentType = loan.is_flat_installment ? 'flat_installment' : (row.paymentType || 'interest');

    setSubmittingIds(prev => ({ ...prev, [loan.id]: true }));
    try {
      const idempotencyKey = `idemp_${collectionType}_${loan.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await api.post('/payments', {
        loan_id: loan.id,
        amount: amountVal,
        payment_type: paymentType,
        notes: `Recorded via Record Payment sheet (${collectionType})`,
        payment_method: 'cash',
        idempotency_key: idempotencyKey
      });

      if (showToast) {
        const typeLabel = paymentType === 'flat_installment' ? 'daily installment' : paymentType;
        showToast(`Recorded LKR ${amountVal.toLocaleString()} ${typeLabel} payment for ${loan.borrower_name}!`);
      }

      // Clear completed row input
      setSelectedRows(prev => {
        const copy = { ...prev };
        delete copy[loan.id];
        return copy;
      });

      if (onRefresh) onRefresh();
    } catch (err) {
      if (showToast) showToast(err.message || 'Payment recording failed.');
    } finally {
      setSubmittingIds(prev => ({ ...prev, [loan.id]: false }));
    }
  };

  const handleSaveAllSelected = async () => {
    const activeEntries = Object.entries(selectedRows).filter(([_, r]) => parseFloat(r.amount) > 0);
    if (activeEntries.length === 0) {
      if (showToast) showToast('No payment amounts entered.');
      return;
    }

    for (const [loanId] of activeEntries) {
      const loan = typeLoans.find(l => String(l.id) === String(loanId));
      if (loan) {
        await handleSavePaymentRow(loan);
      }
    }
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard className="icon" style={{ color: 'var(--accent-blue)' }} /> Record Payment
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Tick Full Due, or tick Partial and enter a custom amount, then Save.
          </p>
        </div>
        <button
          type="button"
          className="glass-btn glass-btn-emerald"
          style={{ padding: '8px 16px', fontSize: '13px' }}
          onClick={handleSaveAllSelected}
        >
          <Check className="icon" /> Save All Entered
        </button>
      </div>

      {/* Collection-type tabs */}
      <div className="loan-file-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', gap: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: '16px' }}>
        {['daily', 'weekly', 'monthly'].map(t => (
          <button
            key={t}
            type="button"
            className="loan-file-tab"
            style={{
              padding: '10px 18px', fontSize: '13px', fontWeight: '700', textTransform: 'capitalize', whiteSpace: 'nowrap',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: collectionType === t ? '3px solid var(--accent-blue)' : '3px solid transparent',
              color: collectionType === t ? 'var(--accent-blue)' : 'var(--text-secondary)'
            }}
            onClick={() => setCollectionType(t)}
          >
            {t} ({activeSource.filter(l => l.status === 'active' && l.interest_type === t).length})
          </button>
        ))}
      </div>

      <input
        type="text"
        className="glass-input"
        placeholder="Search borrower, phone, NIC, or ID..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ marginBottom: '16px' }}
      />

      {loadingLoans ? (
        <SkeletonCards count={4} lines={2} />
      ) : filteredLoans.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Search style={{ width: '28px', height: '28px' }} />
          </div>
          <h4 className="empty-state-title">No {collectionType} Collection Loans Found</h4>
          <p className="empty-state-text">
            {searchTerm ? `No ${collectionType} collection loans match "${searchTerm}".` : `There are no active ${collectionType} collection loans currently.`}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: compact table */}
          <div className="desktop-only" style={{ overflowX: 'auto' }}>
            <table className="glass-table">
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Loan ID</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Name</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Due</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Full Due</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Partial</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Type</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Save</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map(loan => {
                  const totalDue = loan.is_flat_installment
                    ? (parseFloat(loan.principal_outstanding) || 0) + (parseFloat(loan.interest_balance) || 0)
                    : parseFloat(loan.interest_balance) || 0;
                  const row = selectedRows[loan.id] || { mode: null, amount: '', paymentType: 'interest' };
                  const isSubmitting = submittingIds[loan.id];

                  return (
                    <tr key={loan.id} style={{ transition: 'background-color 0.15s ease' }}>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                        <span style={{ color: 'var(--accent-blue)', background: 'rgba(37, 84, 232, 0.08)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px' }}>
                          {loan.reference_number || `STN-${String(loan.id).padStart(3, '0')}`}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <strong style={{ display: 'block', fontSize: '14px' }}>{loan.borrower_name}</strong>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><Phone className="icon" /> {loan.borrower_phone}</span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 'bold', color: totalDue > 0 ? 'var(--accent-rose)' : 'var(--text-primary)', display: 'block' }}>
                          LKR {totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          LKR {periodDue(loan).toLocaleString(undefined, { minimumFractionDigits: 2 })}{periodLabel}{loan.is_flat_installment ? ' (flat)' : ''}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <input
                          type="checkbox"
                          checked={row.mode === 'full'}
                          onChange={e => handleToggleMode(loan, 'full', e.target.checked)}
                          style={{ width: '18px', height: '18px', accentColor: 'var(--accent-emerald)', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            checked={row.mode === 'partial'}
                            onChange={e => handleToggleMode(loan, 'partial', e.target.checked)}
                            style={{ width: '18px', height: '18px', accentColor: 'var(--accent-amber)', cursor: 'pointer' }}
                          />
                          {row.mode === 'partial' && (
                            <input
                              type="number"
                              min="1"
                              autoFocus
                              placeholder="e.g. 200"
                              value={row.amount}
                              onChange={e => updateRowField(loan.id, 'amount', e.target.value)}
                              className="glass-input"
                              style={{ width: '110px', padding: '6px 10px', fontSize: '14px', fontWeight: 'bold' }}
                            />
                          )}
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        {loan.is_flat_installment ? (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Principal + Interest</span>
                        ) : (
                          <select
                            value={row.paymentType || 'interest'}
                            onChange={e => updateRowField(loan.id, 'paymentType', e.target.value)}
                            className="glass-input"
                            style={{ padding: '6px 8px', fontSize: '12px', width: '100px' }}
                          >
                            <option value="interest">Interest</option>
                            <option value="principal">Principal</option>
                          </select>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <button
                          type="button"
                          className="glass-btn glass-btn-emerald"
                          style={{ padding: '6px 14px', fontSize: '12px' }}
                          onClick={() => handleSavePaymentRow(loan)}
                          disabled={isSubmitting || !row.amount}
                        >
                          {isSubmitting ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: one compact card per loan instead of a wide table */}
          <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredLoans.map(loan => {
              const totalDue = loan.is_flat_installment
                ? (parseFloat(loan.principal_outstanding) || 0) + (parseFloat(loan.interest_balance) || 0)
                : parseFloat(loan.interest_balance) || 0;
              const row = selectedRows[loan.id] || { mode: null, amount: '', paymentType: 'interest' };
              const isSubmitting = submittingIds[loan.id];

              return (
                <div key={loan.id} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <span style={{ color: 'var(--accent-blue)', background: 'rgba(37, 84, 232, 0.08)', padding: '2px 7px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                        {loan.reference_number || `STN-${String(loan.id).padStart(3, '0')}`}
                      </span>
                      <strong style={{ display: 'block', fontSize: '14px', marginTop: '4px' }}>{loan.borrower_name}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}><Phone className="icon" /> {loan.borrower_phone}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '15px', color: totalDue > 0 ? 'var(--accent-rose)' : 'var(--text-primary)', display: 'block' }}>
                        LKR {totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        LKR {periodDue(loan).toLocaleString(undefined, { minimumFractionDigits: 2 })}{periodLabel}{loan.is_flat_installment ? ' (flat)' : ''}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={row.mode === 'full'}
                        onChange={e => handleToggleMode(loan, 'full', e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent-emerald)', cursor: 'pointer' }}
                      />
                      Full Due
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={row.mode === 'partial'}
                        onChange={e => handleToggleMode(loan, 'partial', e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent-amber)', cursor: 'pointer' }}
                      />
                      Partial
                    </label>
                  </div>

                  {row.mode === 'partial' && (
                    <input
                      type="number"
                      min="1"
                      autoFocus
                      placeholder="Enter partial amount, e.g. 200"
                      value={row.amount}
                      onChange={e => updateRowField(loan.id, 'amount', e.target.value)}
                      className="glass-input"
                      style={{ marginTop: '10px', fontWeight: 'bold' }}
                    />
                  )}

                  {row.mode && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      {loan.is_flat_installment ? (
                        <span style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Principal + Interest</span>
                      ) : (
                        <select
                          value={row.paymentType || 'interest'}
                          onChange={e => updateRowField(loan.id, 'paymentType', e.target.value)}
                          className="glass-input"
                          style={{ flex: 1, padding: '8px 10px', fontSize: '13px' }}
                        >
                          <option value="interest">Interest</option>
                          <option value="principal">Principal</option>
                        </select>
                      )}
                      <button
                        type="button"
                        className="glass-btn glass-btn-emerald"
                        style={{ padding: '8px 18px', fontSize: '13px', whiteSpace: 'nowrap' }}
                        onClick={() => handleSavePaymentRow(loan)}
                        disabled={isSubmitting || !row.amount}
                      >
                        {isSubmitting ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Next-Day Tasklist Component - Shows tomorrow's expected collections categorized into Daily, Weekly, and Monthly
function NextDayTasklistTab({ loans = [], onSelectLoan, onNavigateRecordPayment }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [fetchedLoans, setFetchedLoans] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loans || loans.length === 0) {
      setLoading(true);
      api.get('/loans?status=active')
        .then(res => setFetchedLoans(Array.isArray(res) ? res : []))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [loans?.length]);

  const sourceLoans = (loans && loans.length > 0) ? loans : fetchedLoans;
  const activeLoans = sourceLoans.filter(l => l.status === 'active');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const dailyDueTomorrow = activeLoans.filter(l => l.interest_type === 'daily');

  const weeklyDueTomorrow = activeLoans.filter(l => {
    if (l.interest_type !== 'weekly') return false;
    if (!l.next_accrual_date) return true;
    const nextAcc = new Date(l.next_accrual_date);
    return nextAcc <= tomorrowEnd;
  });

  const monthlyDueTomorrow = activeLoans.filter(l => {
    if (l.interest_type !== 'monthly') return false;
    if (!l.next_accrual_date) return true;
    const nextAcc = new Date(l.next_accrual_date);
    return nextAcc <= tomorrowEnd;
  });

  const calcExpectedAmount = (l) => {
    const principal = parseFloat(l.principal_amount) || 0;
    const rate = parseFloat(l.interest_rate) || 0;
    const monthlyInterest = (principal * rate) / 100;

    if (l.interest_type === 'daily') return monthlyInterest / 30;
    if (l.interest_type === 'weekly') return monthlyInterest / 4;
    return monthlyInterest;
  };

  const totalDailyAmt = dailyDueTomorrow.reduce((sum, l) => sum + calcExpectedAmount(l), 0);
  const totalWeeklyAmt = weeklyDueTomorrow.reduce((sum, l) => sum + calcExpectedAmount(l), 0);
  const totalMonthlyAmt = monthlyDueTomorrow.reduce((sum, l) => sum + calcExpectedAmount(l), 0);
  const totalExpectedTomorrow = totalDailyAmt + totalWeeklyAmt + totalMonthlyAmt;

  let displayedList = [];
  if (activeTab === 'daily') displayedList = dailyDueTomorrow;
  else if (activeTab === 'weekly') displayedList = weeklyDueTomorrow;
  else if (activeTab === 'monthly') displayedList = monthlyDueTomorrow;
  else displayedList = [...dailyDueTomorrow, ...weeklyDueTomorrow, ...monthlyDueTomorrow];

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    displayedList = displayedList.filter(l =>
      (l.borrower_name || '').toLowerCase().includes(term) ||
      (l.borrower_phone || '').includes(term) ||
      (l.reference_number || '').toLowerCase().includes(term) ||
      (l.nic_number || '').toLowerCase().includes(term)
    );
  }

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar className="icon" style={{ color: 'var(--accent-emerald)' }} /> Next-Day Collection Tasklist ({tomorrow.toLocaleDateString()})
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Scheduled collection tasklist for tomorrow. View and plan route collections categorized by frequency.
          </p>
        </div>

        <input
          type="text"
          className="glass-input"
          placeholder="Search borrower or NIC..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ padding: '8px 12px', minWidth: '220px' }}
        />
      </div>

      {/* KPI Cards Summary for Tomorrow */}
      <div className="responsive-grid-equal-4-col" style={{ marginBottom: '24px' }}>
        <div className="kpi-card kpi-card-emerald">
          <span className="kpi-lbl">Total Expected Tomorrow</span>
          <h3 className="kpi-val" style={{ color: 'var(--accent-emerald)' }}>LKR {Math.round(totalExpectedTomorrow).toLocaleString()}</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Combined collections</span>
        </div>
        <div className="kpi-card kpi-card-blue">
          <span className="kpi-lbl">Daily Route</span>
          <h3 className="kpi-val">{dailyDueTomorrow.length} Loans</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>LKR {Math.round(totalDailyAmt).toLocaleString()}</span>
        </div>
        <div className="kpi-card kpi-card-amber">
          <span className="kpi-lbl">Weekly Route</span>
          <h3 className="kpi-val">{weeklyDueTomorrow.length} Loans</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>LKR {Math.round(totalWeeklyAmt).toLocaleString()}</span>
        </div>
        <div className="kpi-card kpi-card-rose">
          <span className="kpi-lbl">Monthly Route</span>
          <h3 className="kpi-val">{monthlyDueTomorrow.length} Loans</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>LKR {Math.round(totalMonthlyAmt).toLocaleString()}</span>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`glass-btn ${activeTab === 'all' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
          style={{ padding: '6px 14px', fontSize: '12px' }}
          onClick={() => setActiveTab('all')}
        >
          All Tomorrow ({dailyDueTomorrow.length + weeklyDueTomorrow.length + monthlyDueTomorrow.length})
        </button>
        <button
          type="button"
          className={`glass-btn ${activeTab === 'daily' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
          style={{ padding: '6px 14px', fontSize: '12px' }}
          onClick={() => setActiveTab('daily')}
        >
          Daily Collections ({dailyDueTomorrow.length})
        </button>
        <button
          type="button"
          className={`glass-btn ${activeTab === 'weekly' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
          style={{ padding: '6px 14px', fontSize: '12px' }}
          onClick={() => setActiveTab('weekly')}
        >
          Weekly Collections ({weeklyDueTomorrow.length})
        </button>
        <button
          type="button"
          className={`glass-btn ${activeTab === 'monthly' ? 'glass-btn-emerald' : 'glass-btn-secondary'}`}
          style={{ padding: '6px 14px', fontSize: '12px' }}
          onClick={() => setActiveTab('monthly')}
        >
          Monthly Collections ({monthlyDueTomorrow.length})
        </button>
      </div>

      {/* Tasklist Table */}
      {loading ? (
        <SkeletonCards count={4} lines={2} />
      ) : displayedList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Calendar style={{ width: '28px', height: '28px' }} /></div>
          <h4 className="empty-state-title">No Collections Scheduled Tomorrow</h4>
          <p className="empty-state-text">No active loan collections fall under this route category for tomorrow.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="glass-table">
            <thead>
              <tr>
                <th>Loan Ref ID</th>
                <th>Borrower Name</th>
                <th>Category</th>
                <th>Expected Interest Due</th>
                <th>Current Interest Balance</th>
                <th>Assigned Agent</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedList.map(loan => {
                const expectedAmt = calcExpectedAmount(loan);
                const currentBal = parseFloat(loan.interest_balance) || 0;

                return (
                  <tr key={loan.id}>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                      <span style={{ color: 'var(--accent-blue)', background: 'rgba(37, 84, 232, 0.08)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px' }}>
                        {loan.reference_number || `STN-${String(loan.id).padStart(3, '0')}`}
                      </span>
                    </td>
                    <td>
                      <strong style={{ display: 'block' }}>{loan.borrower_name}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><Phone className="icon" /> {loan.borrower_phone}</span>
                      {loan.nic_number && <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>NIC: {loan.nic_number}</span>}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>
                      <span className={`badge ${loan.interest_type === 'daily' ? 'badge-active' : 'badge-pending'}`}>
                        {loan.interest_type} collection
                      </span>
                    </td>
                    <td style={{ fontWeight: 'bold', color: 'var(--accent-emerald)' }}>
                      LKR {Math.round(expectedAmt).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 'bold', color: currentBal > 0 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                      LKR {currentBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td>{loan.agent_name || 'Office Collector'}</td>
                    <td>
                      <button
                        type="button"
                        className="glass-btn glass-btn-emerald"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => {
                          if (onNavigateRecordPayment) onNavigateRecordPayment(loan);
                          else if (onSelectLoan) onSelectLoan(loan.id);
                        }}
                      >
                        Record Payment
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
