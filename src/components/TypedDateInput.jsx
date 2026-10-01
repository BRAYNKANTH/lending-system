'use client';

import { useEffect, useRef, useState } from 'react';

// A native <input type="date"> forces scrolling its built-in year dropdown
// back however many decades to reach a date of birth or an old backdated
// date — slow and fiddly, especially on a phone — and its displayed
// day/month order follows the browser/OS locale rather than being
// controllable, which reads as a US mm/dd/yyyy date to a Sri Lankan user on
// some browsers. This drop-in replacement takes plain typed Day/Month/Year
// instead, shown as three small boxes separated by "/", but still reads
// and writes the exact same ISO "YYYY-MM-DD" string every existing
// onChange handler already expects (via a synthetic {target:{value}}
// event) — swap the <input> for this and nothing else at the call site
// needs to change. Auto-advances focus to the next box once a box is
// filled, so typing a full date is one continuous motion instead of three
// separate taps.
//
// Shared between the authenticated app (LendApp.jsx) and the public
// borrower-intake form (BorrowerIntakeForm.jsx) — a borrower filling in
// their own Date of Birth on /apply deserves the same unambiguous date
// entry as an admin does.
export function TypedDateInput({ id, value, onChange, required, error, style }) {
  // Each box's digits live in local state rather than being derived straight
  // from `value` on every render. A date is only a valid ISO string once all
  // three boxes are full, so until then `value` stays '' — if the boxes
  // re-rendered from `value` directly, every keystroke before the date was
  // complete would get wiped back to blank by the very next render.
  const [digits, setDigits] = useState(() => {
    const [y = '', m = '', d = ''] = (value || '').split('-');
    return { d, m, y };
  });
  const lastEmitted = useRef(value || '');
  const dayRef = useRef(null);
  const monthRef = useRef(null);
  const yearRef = useRef(null);

  // Re-sync from `value` only when it changed from outside this component
  // (e.g. a form reset or loading an existing record) — not when it changed
  // because we just emitted it ourselves.
  useEffect(() => {
    if ((value || '') !== lastEmitted.current) {
      const [y = '', m = '', d = ''] = (value || '').split('-');
      setDigits({ d, m, y });
      lastEmitted.current = value || '';
    }
  }, [value]);

  const { d: dd, m: mm, y: yyyy } = digits;

  const emit = (d, m, y) => {
    setDigits({ d, m, y });
    const valid = d.length === 2 && m.length === 2 && y.length === 4 &&
      Number(d) >= 1 && Number(d) <= 31 && Number(m) >= 1 && Number(m) <= 12;
    const next = valid ? `${y}-${m}-${d}` : '';
    lastEmitted.current = next;
    onChange({ target: { value: next } });
  };

  const boxStyle = {
    width: '48px', textAlign: 'center', padding: '10px 4px',
    ...(error ? { borderColor: 'var(--accent-rose)', borderWidth: '2px' } : {})
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', ...style }}>
      <input
        ref={dayRef} id={id} type="text" inputMode="numeric" placeholder="DD" maxLength={2}
        className="glass-input" style={boxStyle} value={dd} required={required}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 2);
          emit(v, mm, yyyy);
          if (v.length === 2) monthRef.current?.focus();
        }}
      />
      <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>/</span>
      <input
        ref={monthRef} type="text" inputMode="numeric" placeholder="MM" maxLength={2}
        className="glass-input" style={boxStyle} value={mm} required={required}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 2);
          emit(dd, v, yyyy);
          if (v.length === 2) yearRef.current?.focus();
        }}
      />
      <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>/</span>
      <input
        ref={yearRef} type="text" inputMode="numeric" placeholder="YYYY" maxLength={4}
        className="glass-input" style={{ ...boxStyle, width: '64px' }} value={yyyy} required={required}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 4);
          emit(dd, mm, v);
        }}
      />
    </div>
  );
}
