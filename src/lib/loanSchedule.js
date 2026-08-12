export function isValidSriLankanNIC(nic) {
  const cleaned = nic.trim().toUpperCase();
  return /^[0-9]{9}[VX]$/.test(cleaned) || /^[0-9]{12}$/.test(cleaned);
}

// Sri Lanka is UTC+5:30 year-round (no DST) — fixed, safe to hardcode.
const SRI_LANKA_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

// The UTC instants bounding "today" in Sri Lanka wall-clock time — [start,
// end) — for queries like "was there a transaction today" that need to
// agree with what a Sri Lankan user considers "today" regardless of the
// server process's own timezone (UTC on Vercel, local elsewhere). Same
// shift-compute-shift-back approach as addInterval below.
export function getSriLankaTodayRange(now = new Date()) {
  const slTime = new Date(now.getTime() + SRI_LANKA_OFFSET_MS);
  slTime.setUTCHours(0, 0, 0, 0);
  const start = new Date(slTime.getTime() - SRI_LANKA_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function addInterval(date, interestType, count = 1) {
  // "Midnight" here means Sri Lanka midnight, not the server's own local
  // time — setHours()/setDate() operate on whatever timezone the Node
  // process itself is running in, which is the dev machine's OS timezone
  // locally but UTC on Vercel. Without correcting for that, the exact same
  // code would compute a different accrual/maturity time depending on
  // where it happens to run (a 5.5h drift between local testing and
  // production). Shifting into Sri Lanka's wall-clock time, doing the math
  // with UTC-methods (immune to the server's own TZ), then shifting back
  // makes this deterministic everywhere.
  const slTime = new Date(date.getTime() + SRI_LANKA_OFFSET_MS);

  if (interestType === 'monthly') {
    slTime.setUTCMonth(slTime.getUTCMonth() + count);
  } else {
    const days = interestType === 'daily' ? 1 : 7;
    slTime.setUTCDate(slTime.getUTCDate() + days * count);
  }
  slTime.setUTCHours(0, 0, 0, 0); // Align to Sri Lanka midnight

  return new Date(slTime.getTime() - SRI_LANKA_OFFSET_MS);
}
