'use client';

import React, { useState, useEffect } from 'react';
import { platformApi } from '@/lib/platformApiClient.js';
import {
  Building2, Plus, LogOut, Search, X, Check,
  ShieldCheck, Pencil, Copy, Eye, EyeOff, CircleCheck, CircleAlert
} from 'lucide-react';

const STATUS_LABEL = { active: 'Active', trial: 'Trial', suspended: 'Suspended' };
const STATUS_BADGE_CLASS = { active: 'badge-active', trial: 'badge-pending', suspended: 'badge-defaulted' };

const EMPTY_FORM = {
  name: '', logo_url: '', primary_color: '', contact_name: '', contact_email: '',
  contact_phone: '', database_url: '', custom_domain: '', status: 'active', notes: ''
};

// Hides the password segment of a Postgres connection string for casual
// on-screen display (org list, screen shares) — the full value is still
// returned by the API and shown when actually editing a specific org.
function maskDbUrl(url) {
  if (!url) return '';
  try {
    return url.replace(/(postgresql:\/\/[^:]+:)([^@]+)(@)/, '$1••••••$3');
  } catch {
    return '••••••••';
  }
}

export default function PlatformAdminApp() {
  const [token, setToken] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [bootChecked, setBootChecked] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  const [orgs, setOrgs] = useState([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingOrgId, setEditingOrgId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDbUrl, setShowDbUrl] = useState(false);
  const [toastAlerts, setToastAlerts] = useState([]);

  const showToast = (message, type = 'success') => {
    const id = Date.now() + '_' + Math.random().toString(36).slice(2);
    setToastAlerts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToastAlerts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('platform_admin_token');
    const storedAdmin = localStorage.getItem('platform_admin');
    if (storedToken && storedAdmin) {
      try {
        setToken(storedToken);
        setAdmin(JSON.parse(storedAdmin));
      } catch {
        localStorage.removeItem('platform_admin_token');
        localStorage.removeItem('platform_admin');
      }
    }
    setBootChecked(true);

    const handleExpired = () => {
      setToken(null);
      setAdmin(null);
      setLoginError('Session expired. Please log in again.');
    };
    window.addEventListener('platform-auth-expired', handleExpired);
    return () => window.removeEventListener('platform-auth-expired', handleExpired);
  }, []);

  useEffect(() => {
    if (token) fetchOrgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchOrgs = async () => {
    setOrgsLoading(true);
    try {
      const res = await platformApi.get('/organizations');
      setOrgs(res.organizations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setOrgsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const res = await platformApi.post('/auth/login', loginForm);
      localStorage.setItem('platform_admin_token', res.token);
      localStorage.setItem('platform_admin', JSON.stringify(res.admin));
      setToken(res.token);
      setAdmin(res.admin);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('platform_admin_token');
    localStorage.removeItem('platform_admin');
    setToken(null);
    setAdmin(null);
  };

  const openAddModal = () => {
    setEditingOrgId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowDbUrl(false);
    setShowModal(true);
  };

  const openEditModal = (org) => {
    setEditingOrgId(org.id);
    setForm({
      name: org.name || '', logo_url: org.logo_url || '', primary_color: org.primary_color || '',
      contact_name: org.contact_name || '', contact_email: org.contact_email || '', contact_phone: org.contact_phone || '',
      database_url: org.database_url || '', custom_domain: org.custom_domain || '', status: org.status || 'active',
      notes: org.notes || ''
    });
    setFormError('');
    setShowDbUrl(false);
    setShowModal(true);
  };

  const handleLogoFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setForm(prev => ({ ...prev, logo_url: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Organization name is required.');
      return;
    }
    setSaving(true);
    try {
      if (editingOrgId) {
        await platformApi.patch(`/organizations/${editingOrgId}`, form);
      } else {
        await platformApi.post('/organizations', form);
      }
      setShowModal(false);
      await fetchOrgs();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusChange = async (org, status) => {
    try {
      await platformApi.patch(`/organizations/${org.id}`, { status });
      showToast(`${org.name} status changed to ${STATUS_LABEL[status] || status}.`);
      fetchOrgs();
    } catch (err) {
      showToast(err.message || 'Could not update organization status.', 'error');
    }
  };

  if (!bootChecked) return null;

  // ---------- Login screen ----------
  if (!token || !admin) {
    return (
      <div className="login-screen-wrapper">
        <div className="login-card" style={{ maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ width: '52px', height: '52px', margin: '0 auto 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck style={{ width: '26px', height: '26px' }} />
            </div>
            <h2 style={{ fontSize: '22px', marginBottom: '4px' }}>Platform Admin</h2>
            <p style={{ fontSize: '13px' }}>Master control panel — organization registry</p>
          </div>

          {loginError && (
            <div style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', color: '#fecaca', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px' }}>EMAIL</label>
              <input required type="email" className="glass-input" placeholder="you@example.com"
                value={loginForm.email} onChange={e => setLoginForm(prev => ({ ...prev, email: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px' }}>PASSWORD</label>
              <input required type="password" className="glass-input" placeholder="••••••••"
                value={loginForm.password} onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))} />
            </div>
            <button type="submit" className="glass-btn" disabled={loading} style={{ width: '100%', padding: '14px', marginTop: '4px' }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---------- Dashboard ----------
  const filteredOrgs = orgs.filter(o => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return o.name.toLowerCase().includes(t) || (o.contact_email || '').toLowerCase().includes(t) || (o.slug || '').toLowerCase().includes(t);
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Toast Alert overlay — local UI confirmation/error, not tied to any real notification. */}
      <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '380px' }}>
        {toastAlerts.map(toast => (
          <div key={toast.id} className="animate-fade-in" style={{ padding: '16px', background: toast.type === 'error' ? 'var(--accent-rose, #dc2626)' : 'var(--accent-emerald)', border: 'none', color: '#ffffff', borderRadius: '8px', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {toast.type === 'error' ? <CircleAlert className="icon" /> : <CircleCheck className="icon" />}
                {toast.type === 'error' ? 'Error' : 'Success'}
              </span>
            </div>
            <p style={{ fontSize: '13px', lineHeight: '1.4' }}>{toast.message}</p>
          </div>
        ))}
      </div>

      <header className="app-header">
        <div className="app-header-info">
          <h1 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="app-brand-mark"><ShieldCheck /></div>
            <span style={{ fontWeight: '800' }}>PLATFORM ADMIN</span>
          </h1>
        </div>
        <div className="app-header-nav">
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{admin.name}</span>
          <button className="glass-btn glass-btn-secondary" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={handleLogout}>
            <LogOut className="icon" /> <span className="btn-label-text">Logout</span>
          </button>
        </div>
      </header>

      <div className="dashboard-container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '26px', marginBottom: '4px' }}>Organizations</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{orgs.length} total · {orgs.filter(o => o.status === 'active').length} active</p>
            </div>
            <button className="glass-btn glass-btn-emerald" onClick={openAddModal}>
              <Plus className="icon" /> Add Organization
            </button>
          </div>

          <div style={{ position: 'relative', maxWidth: '380px' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--text-muted)' }} />
            <input type="text" className="glass-input" placeholder="Search name, slug, or contact email…"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '38px' }} />
          </div>

          {orgsLoading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading organizations…</p>
          ) : filteredOrgs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Building2 style={{ width: '28px', height: '28px' }} /></div>
              <h4 className="empty-state-title">{orgs.length === 0 ? 'No Organizations Yet' : 'No Matches'}</h4>
              <p className="empty-state-text">{orgs.length === 0 ? 'Add your first client organization to get started.' : 'Try a different search term.'}</p>
            </div>
          ) : (
            <>
              <div className="desktop-only" style={{ overflowX: 'auto' }}>
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th>Organization</th>
                      <th>Contact</th>
                      <th>Database</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrgs.map(org => (
                      <tr key={org.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {org.logo_url ? (
                              <img src={org.logo_url} alt={`${org.name} logo`} style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-light)' }} />
                            ) : (
                              <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Building2 style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                              </div>
                            )}
                            <div>
                              <strong style={{ display: 'block' }}>{org.name}</strong>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{org.slug}{org.custom_domain ? ` · ${org.custom_domain}` : ''}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {org.contact_name && <span style={{ display: 'block', fontSize: '13px' }}>{org.contact_name}</span>}
                          {org.contact_email && <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)' }}>{org.contact_email}</span>}
                          {org.contact_phone && <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)' }}>{org.contact_phone}</span>}
                        </td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: org.database_url ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                            {org.database_url ? maskDbUrl(org.database_url) : 'Not set'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${STATUS_BADGE_CLASS[org.status] || 'badge-pending'}`}>{STATUS_LABEL[org.status] || org.status}</span>
                        </td>
                        <td>
                          <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => openEditModal(org)}>
                            <Pencil className="icon" /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mobile-only mobile-card-list">
                {filteredOrgs.map(org => (
                  <div key={org.id} className="mobile-row-card">
                    <div className="mobile-row-card-header">
                      <span className="mobile-row-card-title">{org.name}</span>
                      <span className={`badge ${STATUS_BADGE_CLASS[org.status] || 'badge-pending'}`}>{STATUS_LABEL[org.status] || org.status}</span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{org.slug}</span>
                    {(org.contact_name || org.contact_email) && (
                      <div className="mobile-row-card-grid">
                        <span className="mobile-row-card-label">Contact</span>
                        <span className="mobile-row-card-value">{org.contact_name || org.contact_email || '—'}</span>
                      </div>
                    )}
                    <div className="mobile-row-card-actions">
                      <button className="glass-btn glass-btn-secondary" style={{ flex: '1 1 100%' }} onClick={() => openEditModal(org)}>
                        <Pencil className="icon" /> Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {showModal && (
        <div className="receipt-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="receipt-modal-card" style={{ maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 className="icon" /> {editingOrgId ? 'Edit Organization' : 'Add Organization'}
              </h3>
              <button className="glass-btn glass-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setShowModal(false)}>
                <X className="icon" />
              </button>
            </div>

            {formError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>ORGANIZATION NAME *</label>
                <input required type="text" className="glass-input" placeholder="e.g. Sunrise Micro Finance" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
              </div>

              <div className="form-grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>CONTACT NAME</label>
                  <input type="text" className="glass-input" value={form.contact_name} onChange={e => setForm(prev => ({ ...prev, contact_name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>CONTACT PHONE</label>
                  <input type="tel" className="glass-input" value={form.contact_phone} onChange={e => setForm(prev => ({ ...prev, contact_phone: e.target.value }))} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>CONTACT EMAIL</label>
                <input type="email" className="glass-input" value={form.contact_email} onChange={e => setForm(prev => ({ ...prev, contact_email: e.target.value }))} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>LOGO</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {form.logo_url && <img src={form.logo_url} alt="Logo preview" style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-light)' }} />}
                  <input type="file" accept="image/*" className="glass-input" onChange={handleLogoFile} style={{ padding: '8px' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  DATABASE CONNECTION STRING
                  <span style={{ fontWeight: 'normal', color: 'var(--text-muted)', textTransform: 'none' }}> — their own Supabase project's connection string, for your reference only</span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type={showDbUrl ? 'text' : 'password'}
                    className="glass-input"
                    placeholder="postgresql://postgres:PASSWORD@HOST:6543/postgres"
                    value={form.database_url}
                    onChange={e => setForm(prev => ({ ...prev, database_url: e.target.value }))}
                    style={{ fontFamily: 'monospace', fontSize: '13px' }}
                  />
                  <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '10px' }} onClick={() => setShowDbUrl(v => !v)} title={showDbUrl ? 'Hide' : 'Show'}>
                    {showDbUrl ? <EyeOff className="icon" /> : <Eye className="icon" />}
                  </button>
                  {form.database_url && (
                    <button type="button" className="glass-btn glass-btn-secondary" style={{ padding: '10px' }} onClick={() => navigator.clipboard.writeText(form.database_url)} title="Copy">
                      <Copy className="icon" />
                    </button>
                  )}
                </div>
              </div>

              <div className="form-grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>CUSTOM DOMAIN</label>
                  <input type="text" className="glass-input" placeholder="app.theirdomain.com" value={form.custom_domain} onChange={e => setForm(prev => ({ ...prev, custom_domain: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>STATUS</label>
                  <select className="glass-input" value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>NOTES</label>
                <textarea className="glass-input" rows={3} placeholder="Plan tier, billing notes, onboarding status…" value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              <button type="submit" className="glass-btn glass-btn-emerald" disabled={saving} style={{ width: '100%', padding: '14px', marginTop: '4px' }}>
                <Check className="icon" /> {saving ? 'Saving…' : editingOrgId ? 'Save Changes' : 'Create Organization'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
