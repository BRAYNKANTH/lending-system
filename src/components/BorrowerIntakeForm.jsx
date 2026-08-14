'use client';

import React, { useState, useEffect } from 'react';
import { CircleCheck, Landmark } from 'lucide-react';
import { MAX_KYC_PHOTOS, appendCompressedPhotos } from '@/lib/clientImageCompress.js';

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
    nicPhotoLabel: 'NIC Photo',
    photoProofLabel: 'Photo Proof (e.g. utility bill or other ID evidence)',
    upToPhotosHint: 'Up to 4 photos.', optionalPrefix: 'Optional.',
    addPhotos: 'Add Photos', removePhoto: 'Remove', processingPhotos: 'Processing photo(s)…',
    purpose: 'What is the loan for?', purposePh: 'e.g. Business, home repair, medical',
    income: 'Monthly Income (LKR)',
    spouseHeading: 'Spouse Details (optional, if married)',
    spouseName: "Spouse's Name",
    spouseNic: "Spouse's NIC",
    spouseOccupation: "Spouse's Occupation",
    guarantorsHeading: 'Guarantors (optional, up to 2)',
    guarantorsSubtitle: "If you already know who will guarantee this loan, add their details now — otherwise an agent can add this later.",
    addGuarantor: (n) => `+ Add Guarantor ${n}`,
    guarantorLabel: 'Guarantor',
    removeGuarantor: 'Remove this guarantor',
    gName: 'Full Name', gNic: 'NIC Number', gPhone: 'Mobile Number', gAddress: 'Address',
    gFinanceHeading: 'Financial Details (optional)',
    gIncomeBusiness: 'Monthly Income — Business (LKR)',
    gIncomeAgri: 'Monthly Income — Agriculture (LKR)',
    gIncomeOther: 'Monthly Income — Other (LKR)',
    gExpenseFood: 'Monthly Expense — Food (LKR)',
    gExpenseRent: 'Monthly Expense — House Rent (LKR)',
    gExpenseOther: 'Monthly Expense — Other (LKR)',
    gProtectedDebtAct: 'Protected under the Debt Recovery (Special Provisions) Act',
    gPendingCourtCases: 'Has pending court cases',
    notes: 'Anything else the agent should know?', notesPh: 'Optional',
    submit: 'Submit Application',
    submitting: 'Submitting...',
    required: 'Name and mobile number are required.',
    requiredPhotos: 'A NIC photo and a photo proof (at least 1 each) are required.',
    requiredGuarantorPhoto: 'Please add a NIC photo for each guarantor you have added, or remove that guarantor.',
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
    nicPhotoLabel: 'தே.அ.அ. புகைப்படம்',
    photoProofLabel: 'புகைப்பட ஆதாரம் (எ.கா. மின்சார பில் அல்லது வேறு அடையாள ஆவணம்)',
    upToPhotosHint: 'அதிகபட்சம் 4 புகைப்படங்கள்.', optionalPrefix: 'விருப்பம்.',
    addPhotos: 'புகைப்படங்களைச் சேர்க்க', removePhoto: 'நீக்கு', processingPhotos: 'புகைப்படம் தயாராகிறது…',
    purpose: 'கடன் எதற்காக?', purposePh: 'எ.கா. வியாபாரம், வீடு பழுது, மருத்துவம்',
    income: 'மாத வருமானம் (ரூபா)',
    spouseHeading: 'மனைவி/கணவர் விவரங்கள் (விருப்பம், திருமணமானால்)',
    spouseName: 'பெயர்',
    spouseNic: 'தே.அ.அ. எண்',
    spouseOccupation: 'தொழில்',
    guarantorsHeading: 'உத்தரவாதிகள் (விருப்பம், அதிகபட்சம் 2)',
    guarantorsSubtitle: 'இந்தக் கடனுக்கு உத்தரவாதம் அளிப்பவர் யார் என்று ஏற்கனவே தெரிந்தால், அவர்களின் விவரங்களை இப்போது சேர்க்கவும் — இல்லையெனில் ஒரு முகவர் பின்னர் இதைச் சேர்க்கலாம்.',
    addGuarantor: (n) => `+ உத்தரவாதி ${n} சேர்க்க`,
    guarantorLabel: 'உத்தரவாதி',
    removeGuarantor: 'இந்த உத்தரவாதியை நீக்கு',
    gName: 'முழுப் பெயர்', gNic: 'தே.அ.அ. எண்', gPhone: 'கைபேசி எண்', gAddress: 'முகவரி',
    gFinanceHeading: 'நிதி விவரங்கள் (விருப்பம்)',
    gIncomeBusiness: 'மாத வருமானம் — வியாபாரம் (ரூபா)',
    gIncomeAgri: 'மாத வருமானம் — விவசாயம் (ரூபா)',
    gIncomeOther: 'மாத வருமானம் — மற்றவை (ரூபா)',
    gExpenseFood: 'மாத செலவு — உணவு (ரூபா)',
    gExpenseRent: 'மாத செலவு — வீட்டு வாடகை (ரூபா)',
    gExpenseOther: 'மாத செலவு — மற்றவை (ரூபா)',
    gProtectedDebtAct: 'கடன் மீட்பு (சிறப்பு ஏற்பாடுகள்) சட்டத்தின் கீழ் பாதுகாக்கப்பட்டவர்',
    gPendingCourtCases: 'நிலுவையில் உள்ள நீதிமன்ற வழக்குகள் உள்ளன',
    notes: 'முகவர் அறிந்திருக்க வேண்டிய வேறு ஏதேனும்?', notesPh: 'விருப்பத்திற்குரியது',
    submit: 'விண்ணப்பத்தை அனுப்பு',
    submitting: 'அனுப்புகிறது...',
    required: 'பெயரும் கைபேசி எண்ணும் அவசியம்.',
    requiredPhotos: 'தே.அ.அ. புகைப்படமும் புகைப்பட ஆதாரமும் (குறைந்தது ஒவ்வொன்றும்) அவசியம்.',
    requiredGuarantorPhoto: 'நீங்கள் சேர்த்த ஒவ்வொரு உத்தரவாதிக்கும் தே.அ.அ. புகைப்படத்தைச் சேர்க்கவும், அல்லது அந்த உத்தரவாதியை நீக்கவும்.',
    successTitle: 'அனுப்பப்பட்டது!',
    successBody: 'நன்றி — இது எங்கள் குழுவிற்கு அனுப்பப்பட்டது. விவரங்களை உறுதிப்படுத்த ஒரு முகவர் விரைவில் தொடர்பு கொள்வார்.',
    another: 'மற்றொரு விண்ணப்பத்தை அனுப்பு',
    filledBy: 'நீங்கள் இதை வேறு ஒருவருக்காக நிரப்பினால், அதுவும் பரவாயில்லை — அவர்களின் விவரங்களை உள்ளிடவும்.'
  }
};

const EMPTY_FORM = {
  borrower_name: '', borrower_phone: '', borrower_address: '', date_of_birth: '', nic_number: '',
  nic_photos: [], photo_proofs: [],
  loan_purpose: '', monthly_income: '',
  spouse_name: '', spouse_nic: '', spouse_occupation: '', notes: ''
};

// No photo_proofs here (unlike the borrower's own fields, and unlike the
// staff Give Loan wizard's guarantor form) — a guarantor's NIC Photo is
// enough for this public intake step; an agent collects photo proof from
// the guarantor in person if the loan actually goes ahead.
const EMPTY_GUARANTOR = {
  full_name: '', nic_number: '', address: '', phone: '',
  nic_photos: [],
  protected_under_debt_act: false, has_pending_court_cases: false,
  monthly_income_business: '', monthly_income_agriculture: '', monthly_income_other: '',
  monthly_expense_food: '', monthly_expense_rent: '', monthly_expense_other: ''
};

export default function BorrowerIntakeForm() {
  const [lang, setLang] = useState('en');
  const t = TEXT[lang];

  const [orgSettings, setOrgSettings] = useState({ org_name: '', logo_url: null });
  const [form, setForm] = useState(EMPTY_FORM);
  // Two guarantor slots, each null (not added) or a filled-in guarantor
  // object — matches the staff wizard's cap, kept simple here as two fixed
  // optional slots rather than a dynamic list since that's all this form
  // needs to support.
  const [guarantors, setGuarantors] = useState([null, null]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Counts in-flight photo compressions (can overlap across fields) so the
  // submit button can be disabled until every selected photo has finished
  // being read/compressed into a data URL.
  const [processingCount, setProcessingCount] = useState(0);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(res => {
      setOrgSettings({ org_name: res.org_name || '', logo_url: res.logo_url || null });
    }).catch(() => {});
  }, []);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handlePhotoSelect = async (e, updateArrayFn) => {
    // input.files is a LIVE FileList tied to the input element — resetting
    // e.target.value on the next line (done so the same file can be
    // re-selected later) clears that FileList in place too, so it must be
    // copied into a plain array first. Grabbing the live reference and
    // clearing the input right after (as this used to) left
    // appendCompressedPhotos reading an already-emptied FileList, silently
    // uploading nothing while the input visibly reverted to "No file
    // chosen" — this is what looked like "choosing a file does nothing".
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    setProcessingCount(c => c + 1);
    try {
      await appendCompressedPhotos(files, updateArrayFn, () => setError(`Only ${MAX_KYC_PHOTOS} photos are kept per field.`));
    } catch (err) {
      setError(err.message || 'Failed to process one of the selected photos.');
    } finally {
      setProcessingCount(c => c - 1);
    }
  };

  const updateGuarantorField = (idx, field, value) => {
    setGuarantors(prev => prev.map((g, i) => (i === idx ? { ...g, [field]: value } : g)));
  };

  const addGuarantorSlot = (idx) => setGuarantors(prev => prev.map((g, i) => (i === idx ? { ...EMPTY_GUARANTOR } : g)));
  const removeGuarantorSlot = (idx) => setGuarantors(prev => prev.map((g, i) => (i === idx ? null : g)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.borrower_name.trim() || !form.borrower_phone.trim()) {
      setError(t.required);
      return;
    }
    if (form.nic_photos.length === 0 || form.photo_proofs.length === 0) {
      setError(t.requiredPhotos);
      return;
    }
    const activeGuarantors = guarantors.filter(Boolean);
    if (activeGuarantors.some(g => !g.nic_photos || g.nic_photos.length === 0)) {
      setError(t.requiredGuarantorPhoto);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        language: lang,
        guarantors: guarantors.filter(Boolean)
      };
      const res = await fetch('/api/public/borrower-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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

  // Shared multi-photo field — used for the borrower's own NIC Photo /
  // Photo Proof (both required), and each guarantor's NIC Photo (optional,
  // since the whole guarantor section is optional), so this bit of
  // upload+thumbnail+remove UI isn't repeated separately for each.
  const PhotoField = ({ label, required, photos, onSelect, onRemove }) => (
    <div style={fieldWrap}>
      <label style={labelStyle}>{label} {required && '*'} {photos.length > 0 && `(${photos.length}/${MAX_KYC_PHOTOS})`}</label>
      <p style={{ fontSize: '12px', color: '#888', margin: '0 0 8px' }}>{required ? t.upToPhotosHint : `${t.optionalPrefix} ${t.upToPhotosHint}`}</p>
      <input type="file" accept="image/*" multiple disabled={photos.length >= MAX_KYC_PHOTOS} onChange={onSelect} style={inputStyle} />
      {photos.length > 0 && (
        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {photos.map((p, idx) => (
            <div key={idx} style={{ position: 'relative' }}>
              <img src={p} alt={`${label} ${idx + 1}`} style={{ width: '56px', height: '42px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #d8dde6' }} />
              <button type="button" onClick={() => onRemove(idx)} title={t.removePhoto} style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%', background: '#f43f5e', color: '#fff', border: 'none', fontSize: '11px', lineHeight: 1, cursor: 'pointer' }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#eef2f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ maxWidth: '440px', width: '100%', background: '#fff', borderRadius: '16px', padding: '40px 32px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <CircleCheck style={{ width: '56px', height: '56px', color: '#10b981', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '10px' }}>{t.successTitle}</h2>
          <p style={{ color: '#555', fontSize: '15px', lineHeight: '1.5', marginBottom: '24px' }}>{t.successBody}</p>
          <button
            type="button"
            onClick={() => { setForm(EMPTY_FORM); setGuarantors([null, null]); setSubmitted(false); }}
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

            <PhotoField
              label={t.nicPhotoLabel} required
              photos={form.nic_photos}
              onSelect={e => handlePhotoSelect(e, fn => setForm(prev => ({ ...prev, nic_photos: fn(prev.nic_photos) })))}
              onRemove={idx => setForm(prev => ({ ...prev, nic_photos: prev.nic_photos.filter((_, i) => i !== idx) }))}
            />
            <PhotoField
              label={t.photoProofLabel} required
              photos={form.photo_proofs}
              onSelect={e => handlePhotoSelect(e, fn => setForm(prev => ({ ...prev, photo_proofs: fn(prev.photo_proofs) })))}
              onRemove={idx => setForm(prev => ({ ...prev, photo_proofs: prev.photo_proofs.filter((_, i) => i !== idx) }))}
            />

            <div style={fieldWrap}>
              <label style={labelStyle}>{t.purpose}</label>
              <input style={inputStyle} value={form.loan_purpose} onChange={e => update('loan_purpose', e.target.value)} placeholder={t.purposePh} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>{t.income}</label>
              <input style={inputStyle} type="number" min="0" value={form.monthly_income} onChange={e => update('monthly_income', e.target.value)} />
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

            <div style={{ borderTop: '1px solid #e8ecf3', margin: '24px 0 16px', paddingTop: '20px' }}>
              <p style={{ fontSize: '15px', fontWeight: '800', color: '#222', margin: '0 0 4px' }}>{t.guarantorsHeading}</p>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 14px' }}>{t.guarantorsSubtitle}</p>

              {[0, 1].map(idx => {
                const g = guarantors[idx];
                if (!g) {
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => addGuarantorSlot(idx)}
                      style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px dashed #b7c2d6', background: '#f7f9fc', color: '#2554e8', fontWeight: '700', fontSize: '13px', cursor: 'pointer', marginBottom: '14px' }}
                    >
                      {t.addGuarantor(idx + 1)}
                    </button>
                  );
                }
                return (
                  <div key={idx} style={{ border: '1px solid #e8ecf3', borderRadius: '12px', padding: '16px', marginBottom: '16px', background: '#fbfcfe' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <strong style={{ fontSize: '13px', color: '#444' }}>{`${t.guarantorLabel} ${idx + 1}`}</strong>
                      <button type="button" onClick={() => removeGuarantorSlot(idx)} style={{ background: 'none', border: 'none', color: '#f43f5e', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                        {t.removeGuarantor}
                      </button>
                    </div>

                    <div style={fieldWrap}>
                      <label style={labelStyle}>{t.gName}</label>
                      <input style={inputStyle} value={g.full_name} onChange={e => updateGuarantorField(idx, 'full_name', e.target.value)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
                      <div>
                        <label style={labelStyle}>{t.gNic}</label>
                        <input style={inputStyle} value={g.nic_number} onChange={e => updateGuarantorField(idx, 'nic_number', e.target.value)} placeholder={t.nicPh} />
                      </div>
                      <div>
                        <label style={labelStyle}>{t.gPhone}</label>
                        <input style={inputStyle} type="tel" value={g.phone} onChange={e => updateGuarantorField(idx, 'phone', e.target.value)} placeholder={t.phonePh} />
                      </div>
                    </div>
                    <div style={fieldWrap}>
                      <label style={labelStyle}>{t.gAddress}</label>
                      <input style={inputStyle} value={g.address} onChange={e => updateGuarantorField(idx, 'address', e.target.value)} />
                    </div>

                    <PhotoField
                      label={t.nicPhotoLabel} required
                      photos={g.nic_photos}
                      onSelect={e => handlePhotoSelect(e, fn => updateGuarantorField(idx, 'nic_photos', fn(g.nic_photos)))}
                      onRemove={pi => updateGuarantorField(idx, 'nic_photos', g.nic_photos.filter((_, i) => i !== pi))}
                    />

                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#444', margin: '16px 0 10px' }}>{t.gFinanceHeading}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                      <div>
                        <label style={labelStyle}>{t.gIncomeBusiness}</label>
                        <input style={inputStyle} type="number" min="0" value={g.monthly_income_business} onChange={e => updateGuarantorField(idx, 'monthly_income_business', e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>{t.gIncomeAgri}</label>
                        <input style={inputStyle} type="number" min="0" value={g.monthly_income_agriculture} onChange={e => updateGuarantorField(idx, 'monthly_income_agriculture', e.target.value)} />
                      </div>
                    </div>
                    <div style={fieldWrap}>
                      <label style={labelStyle}>{t.gIncomeOther}</label>
                      <input style={inputStyle} type="number" min="0" value={g.monthly_income_other} onChange={e => updateGuarantorField(idx, 'monthly_income_other', e.target.value)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                      <div>
                        <label style={labelStyle}>{t.gExpenseFood}</label>
                        <input style={inputStyle} type="number" min="0" value={g.monthly_expense_food} onChange={e => updateGuarantorField(idx, 'monthly_expense_food', e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>{t.gExpenseRent}</label>
                        <input style={inputStyle} type="number" min="0" value={g.monthly_expense_rent} onChange={e => updateGuarantorField(idx, 'monthly_expense_rent', e.target.value)} />
                      </div>
                    </div>
                    <div style={fieldWrap}>
                      <label style={labelStyle}>{t.gExpenseOther}</label>
                      <input style={inputStyle} type="number" min="0" value={g.monthly_expense_other} onChange={e => updateGuarantorField(idx, 'monthly_expense_other', e.target.value)} />
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#444', marginBottom: '10px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={g.protected_under_debt_act} onChange={e => updateGuarantorField(idx, 'protected_under_debt_act', e.target.checked)} />
                      {t.gProtectedDebtAct}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#444', cursor: 'pointer' }}>
                      <input type="checkbox" checked={g.has_pending_court_cases} onChange={e => updateGuarantorField(idx, 'has_pending_court_cases', e.target.checked)} />
                      {t.gPendingCourtCases}
                    </label>
                  </div>
                );
              })}
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>{t.notes}</label>
              <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={form.notes} onChange={e => update('notes', e.target.value)} placeholder={t.notesPh} />
            </div>

            {processingCount > 0 && (
              <p style={{ fontSize: '12px', color: '#888', textAlign: 'center', marginBottom: '8px' }}>{t.processingPhotos}</p>
            )}
            <button
              type="submit"
              disabled={submitting || processingCount > 0}
              style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: (submitting || processingCount > 0) ? '#93a5e8' : '#2554e8', color: '#fff', fontWeight: '800', fontSize: '15px', cursor: (submitting || processingCount > 0) ? 'default' : 'pointer', marginTop: '8px' }}
            >
              {submitting ? t.submitting : t.submit}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
