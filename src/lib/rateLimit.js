// Best-effort in-memory rate limiter. On Vercel, serverless instances are
// ephemeral and traffic can land on a fresh instance at any time, so this
// only really helps within a single warm instance handling a burst of
// requests — it is NOT a substitute for a distributed limiter (e.g.
// Upstash/Redis) if you need hard guarantees under real attack traffic.
// The per-user account lockout in lib auth (5 failed logins -> 15 min lock,
// persisted in Postgres) is the strong guarantee; this is a cheap extra layer.
const buckets = new Map();

export function checkRateLimit(key, { windowMs, max }) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return { limited: false };
  }

  bucket.count += 1;
  if (bucket.count > max) {
    return { limited: true, retryAfterMs: windowMs - (now - bucket.start) };
  }
  return { limited: false };
}

export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown';
}
