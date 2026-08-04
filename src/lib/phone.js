// Sri Lankan mobile numbers are 9 significant digits after the leading 0 or
// +94 country code. Login is phone-based and users may type their number in
// any of those forms ("0774048194", "+94774048194", "94 774 048 194", with
// or without spaces) — normalize to the last 9 digits so lookups match
// regardless of how it's entered, without having to rewrite already-stored
// phone numbers across the app.
export function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '').slice(-9);
}
