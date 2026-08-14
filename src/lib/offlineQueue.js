'use client';

import { api } from './apiClient.js';

// Offline payment queue — lets an agent record a collection with no signal
// (common out on a route) instead of losing the entry to a failed request.
// The payload is saved locally with the SAME idempotency_key it was created
// with, so a sync retry — or an accidental double-sync — can never double-
// post it: the backend's `transactions.idempotency_key` UNIQUE constraint
// (see schema.sql) plus the /payments and /daily-collection routes' own
// "already recorded" 409 check make a duplicate submission a safe no-op,
// not a double-charge. This module only ever touches localStorage + the
// existing API routes — no new backend surface.
const QUEUE_KEY = 'lend_offline_payment_queue';
const CHANGED_EVENT = 'lend-offline-queue-changed';

// The exact message apiClient.js throws for a genuine network failure
// (fetch itself rejected — offline, DNS, dropped connection). Anything
// else (400/401/409/500 with a JSON body) is a real server response and
// must NOT be queued — queuing a rejected payment would hide a mistake
// (e.g. "exceeds outstanding balance") behind a fake "saved offline".
const NETWORK_ERROR_MESSAGE = 'Could not reach the server. Check your connection and try again.';

function readQueue() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { count: queue.length } }));
}

export function getQueuedPayments() {
  return readQueue();
}

export function getQueueCount() {
  return readQueue().length;
}

// Subscribe to queue-length changes (queued locally, synced, or removed).
// Returns an unsubscribe function — call it from a useEffect cleanup.
export function onQueueChanged(handler) {
  if (typeof window === 'undefined') return () => {};
  const listener = (e) => handler(e.detail?.count ?? readQueue().length);
  window.addEventListener(CHANGED_EVENT, listener);
  return () => window.removeEventListener(CHANGED_EVENT, listener);
}

/**
 * Attempts to submit a payment payload immediately. On a genuine network
 * failure, saves it to the offline queue instead of throwing, so the
 * caller can show "saved, will sync" rather than a scary error. Any other
 * failure (validation, auth, business-rule rejection) is rethrown exactly
 * as before — queuing is ONLY for "we couldn't reach the server at all".
 *
 * @param {string} endpoint - e.g. '/payments' or '/loans/<id>/daily-collection'
 * @param {object} payload - must include a stable idempotency_key for /payments;
 *   daily-collection payloads don't carry one (see queueMeta.dedupeKey below).
 * @param {object} [queueMeta] - display-only context stored alongside the
 *   payload for the pending-sync UI (borrowerName, amount, etc.) — never
 *   sent to the server.
 * @returns {Promise<{queued: boolean, data?: any}>}
 */
export async function submitPaymentOrQueue(endpoint, payload, queueMeta = {}) {
  try {
    const data = await api.post(endpoint, payload);
    return { queued: false, data };
  } catch (err) {
    if (err?.message !== NETWORK_ERROR_MESSAGE) {
      throw err; // a real server response — never silently swallow this
    }
    const queue = readQueue();
    queue.push({
      // idempotency_key is the natural dedupe id for /payments; daily-collection
      // has no such field, so fall back to a locally-generated one.
      id: payload.idempotency_key || `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      endpoint,
      payload,
      meta: queueMeta,
      queuedAt: Date.now(),
    });
    writeQueue(queue);
    return { queued: true };
  }
}

export function removeFromQueue(id) {
  writeQueue(readQueue().filter((item) => item.id !== id));
}

/**
 * Replays every queued payment against the real API, in the order they
 * were queued (so an agent's collection round replays in the same
 * sequence they actually collected it). Stops attempting further items
 * the moment one fails with ANOTHER network error — if we're offline
 * again, there's no point burning through (and reordering failures on)
 * the rest of the queue this pass; it'll retry the whole remaining queue
 * next time. A non-network failure (e.g. the loan got written off since
 * this was queued) removes that one item and keeps going — it will never
 * succeed by retrying, and one bad entry shouldn't jam the rest.
 */
export async function syncQueuedPayments() {
  const queue = readQueue();
  const synced = [];
  const failed = [];

  for (const item of queue) {
    try {
      await api.post(item.endpoint, item.payload);
      removeFromQueue(item.id);
      synced.push(item);
    } catch (err) {
      if (err?.message === NETWORK_ERROR_MESSAGE) {
        break; // still offline — leave this and the rest queued, try again later
      }
      // A duplicate ("already recorded", 409) means an earlier sync attempt
      // actually succeeded server-side even though this client never got
      // to clear it from the queue (e.g. app closed mid-request) — treat
      // it the same as a fresh success rather than a failure.
      if (err?.message?.toLowerCase().includes('already been recorded')) {
        removeFromQueue(item.id);
        synced.push(item);
        continue;
      }
      removeFromQueue(item.id);
      failed.push({ item, message: err?.message || 'Sync failed.' });
    }
  }

  return { synced, failed, remaining: getQueueCount() };
}
