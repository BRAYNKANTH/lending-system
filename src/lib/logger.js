// Structured server-side error logging. There's no external error-tracking
// service wired up (deliberate choice — no new account/vendor needed right
// now) so Vercel's own log viewer/log drains are the only place these ever
// surface. A bare `console.error('X failed:', error)` only gives you the
// message and an unlabeled stack with no request context, which is exactly
// what made the Aug 2026 loan-creation incident slow to diagnose from logs
// alone. This gives every route the same structured shape instead: a single
// JSON line with a timestamp, which endpoint, and whatever IDs the caller
// knows (userId, loanId, etc.) — filterable/greppable in the Vercel log
// explorer, and still perfectly readable as plain text.
export function logError(context, error, meta = {}) {
  const entry = {
    level: 'error',
    timestamp: new Date().toISOString(),
    context,
    message: error?.message || String(error),
    ...meta,
    stack: error?.stack,
  };
  console.error(JSON.stringify(entry));
}
