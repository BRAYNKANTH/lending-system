'use client';

import React, { useState, useEffect } from 'react';
import { CircleCheck, Landmark } from 'lucide-react';

// Bilingual labels — English/Tamil toggle, since this form is meant to be
// filled in by whoever's literate and available (the borrower, a family
// member, or the agent standing with them), not necessarily someone
// comfortable in English. Kept as a flat lookup rather than a full i18n
// library since this is the only page in the app that needs translation at
// all — everywhere else is staff-only and English-only by choice.
const TEXT = {
  en: {
    title: 'New Loan Application',
    subtitle: 'Fill in as much as you can — an agent will follow up to confirm the rest.',
    langToggle: 'தமிழில் படிக்க',
    name: 'Full Name', namePh: 'e.g. Kumar Selvam',
    phone: 'Mobile Number', phonePh: 'e.g. 0771234567',
    address: 'Address', addressPh: 'e.g. No. 12, Temple Road, Kandy',
    dob: 'Date of Birth',
    nic: 'NIC Number (if you have it)', nicPh: 'e.g. 199012345678 or 123456789V',
    purpose: 'What is the loan for?', purposePh: 'e.g. Business, home repair, medical',
    dependents: 'Number of Dependents',
    income: 'Monthly Income (LKR)',
    spouseHeading: 'Spouse Details (optional, if married)',
    spouseName: "Spouse's Name",
    spouseNic: "Spouse's NIC",
    spouseOccupation: "Spouse's Occupation",
    notes: 'Anything else the agent should know?', notesPh: 'Optional',
    submit: 'Submit Application',
    submitting: 'Submitting...',
    required: 'Name and mobile number are required.',
    successTitle: 'Submitted!',
    successBody: "Thank you — this has been sent to our team. An agent will contact you soon to confirm the details and finish your application.",
    another: 'Submit another application',
    filledBy: 'If you are filling this in for someone else, that is completely fine — just enter their details.'
  },
  ta: {
    title: 'புதிய கடன் விண்ணப்பம்',
    subtitle: 'உங்களால் முடிந்தவரை நிரப்பவும் — மீதமுள்ளவற்றை உறுதிப்படுத்த ஒரு முகவர் தொடர்பு கொள்வார்.',
    langToggle: 'Read in English',
    name: 'முழுப் பெயர்', namePh: 'எ.கா. குமார் செல்வம்',
    phone: 'கைபேசி எண்', phonePh: 'எ.கா. 0771234567',
    address: 'முகவரி', addressPh: 'எ.கா. இல. 12, கோவில் வீதி, கண்டி',
    dob: 'பிறந்த தேதி',
    nic: 'தே.அ.அ. எண் (இருந்தால்)', nicPh: 'எ.கா. 199012345678 அல்லது 123456789V',
    purpose: 'கடன் எதற்காக?', purposePh: 'எ.கா. வியாபாரம், வீடு பழுது, மருத்துவம்',
    dependents: 'சார்ந்திருப்பவர்களின் எண்ணிக்கை',
    income: 'மாத வருமானம் (ரூபா)',
    spouseHeading: 'மனைவி/கணவர் விவரங்கள் (விருப்பம், திருமணமானால்)',
    spouseName: 'பெயர்',
    spouseNic: 'தே.அ.அ. எண்',
    spouseOccupation: 'தொழில்',
    notes: 'முகவர் அறிந்திருக்க வேண்டிய வேறு ஏதேனும்?', notesPh: 'விருப்பத்திற்குரியது',
    submit: 'விண்ணப்பத்தை அனுப்பு',
    submitting: 'அனுப்புகிறது...',
    required: 'பெயரும் கைபேசி எண்ணும் அவசியம்.',
    successTitle: 'அனுப்பப்பட்டது!',
    successBody: 'நன்றி — இது எங்கள் குழுவிற்கு அனுப்பப்பட்டது. விவரங்களை உறுதிப்படுத்த ஒரு முகவர் விரைவில் தொடர்பு கொள்வார்.',
    another: 'மற்றொரு விண்ணப்பத்தை அனுப்பு',
    filledBy: 'நீங்கள் இதை வேறு ஒருவருக்காக நிரப்பினால், அதுவும் பரவாயில்லை — அவர்களின் விவரங்களை உள்ளிடவும்.'
  }
};

const EMPTY_FORM = {
  borrower_name: '', borrower_phone: '', borrower_address: '', date_of_birth: '', nic_number: '',
  loan_purpose: '', dependents_count: '', monthly_income: '',
  spouse_name: '', spouse_nic: '', spouse_occupation: '', notes: ''
};

export default function BorrowerIntakeForm() {
  const [lang, setLang] = useState('en');
  const t = TEXT[lang];

  const [orgSettings, setOrgSettings] = useState({ org_name: '', logo_url: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(res => {
      setOrgSettings({ org_name: res.org_name || '', logo_url: res.logo_url || null });
    }).catch(() => {});
  }, []);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.borrower_name.trim() || !form.borrower_phone.trim()) {
      setError(t.required);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/public/borrower-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, language: lang })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message || 'Something went wrong. Please try again.');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { width: '100%', padding: '12px 14px', fontSize: '15px', borderRadius: '10px', border: '1px solid var(--border-light, #d8dde6)', background: '#fff' };
  const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '700', color: '#444', marginBottom: '6px' };
  const fieldWrap = { marginBottom: '18px' };

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#eef2f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ maxWidth: '440px', width: '100%', background: '#fff', borderRadius: '16px', padding: '40px 32px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <CircleCheck style={{ width: '56px', height: '56px', color: '#10b981', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '10px' }}>{t.successTitle}</h2>
          <p style={{ color: '#555', fontSize: '15px', lineHeight: '1.5', marginBottom: '24px' }}>{t.successBody}</p>
          <button
            type="button"
            onClick={() => { setForm(EMPTY_FORM); setSubmitted(false); }}
            style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: '#2554e8', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
          >
            {t.another}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#eef2f9', padding: '24px 16px' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {orgSettings.logo_url ? (
              <img src={orgSettings.logo_url} alt={orgSettings.org_name} style={{ height: '36px', width: 'auto', objectFit: 'contain' }} />
            ) : (
              <Landmark style={{ width: '28px', height: '28px', color: '#2554e8' }} />
            )}
            <strong style={{ fontSize: '16px' }}>{orgSettings.org_name || '...'}</strong>
          </div>
          <button
            type="button"
            onClick={() => setLang(l => (l === 'en' ? 'ta' : 'en'))}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #d8dde6', background: '#fff', fontSize: '13px', fontWeight: '700', color: '#2554e8', cursor: 'pointer' }}
          >
            {t.langToggle}
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: '16px', padding: '28px 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '6px' }}>{t.title}</h1>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '6px' }}>{t.subtitle}</p>
          <p style={{ color: '#888', fontSize: '12px', marginBottom: '22px', fontStyle: 'italic' }}>{t.filledBy}</p>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '18px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={fieldWrap}>
              <label style={labelStyle}>{t.name} *</label>
              <input style={inputStyle} value={form.borrower_name} onChange={e => update('borrower_name', e.target.value)} placeholder={t.namePh} required />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>{t.phone} *</label>
              <input style={inputStyle} type="tel" value={form.borrower_phone} onChange={e => update('borrower_phone', e.target.value)} placeholder={t.phonePh} required />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>{t.address}</label>
              <input style={inputStyle} value={form.borrower_address} onChange={e => update('borrower_address', e.target.value)} placeholder={t.addressPh} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
              <div>
                <label style={labelStyle}>{t.dob}</label>
                <input style={inputStyle} type="date" max={new Date().toISOString().slice(0, 10)} value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>{t.nic}</label>
                <input style={inputStyle} value={form.nic_number} onChange={e => update('nic_number', e.target.value)} placeholder={t.nicPh} />
              </div>
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>{t.purpose}</label>
              <input style={inputStyle} value={form.loan_purpose} onChange={e => update('loan_purpose', e.target.value)} placeholder={t.purposePh} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
              <div>
                <label style={labelStyle}>{t.dependents}</label>
                <input style={inputStyle} type="number" min="0" value={form.dependents_count} onChange={e => update('dependents_count', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>{t.income}</label>
                <input style={inputStyle} type="number" min="0" value={form.monthly_income} onChange={e => update('monthly_income', e.target.value)} />
              </div>
            </div>

            <p style={{ fontSize: '13px', fontWeight: '700', color: '#444', margin: '20px 0 12px' }}>{t.spouseHeading}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
              <div>
                <label style={labelStyle}>{t.spouseName}</label>
                <input style={inputStyle} value={form.spouse_name} onChange={e => update('spouse_name', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>{t.spouseNic}</label>
                <input style={inputStyle} value={form.spouse_nic} onChange={e => update('spouse_nic', e.target.value)} />
              </div>
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>{t.spouseOccupation}</label>
              <input style={inputStyle} value={form.spouse_occupation} onChange={e => update('spouse_occupation', e.target.value)} />
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>{t.notes}</label>
              <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={form.notes} onChange={e => update('notes', e.target.value)} placeholder={t.notesPh} />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: submitting ? '#93a5e8' : '#2554e8', color: '#fff', fontWeight: '800', fontSize: '15px', cursor: submitting ? 'default' : 'pointer', marginTop: '8px' }}
            >
              {submitting ? t.submitting : t.submit}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
