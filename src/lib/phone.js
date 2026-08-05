// Sri Lankan mobile numbers are 9 significant digits after the leading 0 or
// +94 country code. Login is phone-based and users may type their number in
// any of those forms ("0774048194", "+94774048194", "94 774 048 194", with
// or without spaces) — normalize to the last 9 digits so lookups match
// regardless of how it's entered, without having to rewrite already-stored
// phone numbers across the app.
export function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '').slice(-9);
}

// Text.lk (and most SMS gateways) expect the full international number with
// no '+' and no leading 0, e.g. "94774048194".
export function toTextLkFormat(phone) {
  const last9 = normalizePhone(phone);
  return last9 ? `94${last9}` : '';
}
