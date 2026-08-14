import { describe, it, expect, beforeEach, vi } from 'vitest';

// offlineQueue.js is a 'use client' module gated on `typeof window`, and
// apiClient.js reads `localStorage`/`fetch` directly — neither exists in
// Vitest's default node environment. Mocking api.post (so no real network
// layer is involved) and polyfilling just the browser globals this file
// actually touches keeps this a true unit test of the queueing logic
// itself, not an integration test of fetch/localStorage.
vi.mock('./apiClient.js', () => ({
  api: { post: vi.fn() },
}));

import { api } from './apiClient.js';
import {
  submitPaymentOrQueue,
  syncQueuedPayments,
  getQueuedPayments,
  getQueueCount,
  removeFromQueue,
} from './offlineQueue.js';

beforeEach(() => {
  vi.clearAllMocks();
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    dispatchEvent: () => {},
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, opts) { this.type = type; this.detail = opts?.detail; }
  };
});

const NETWORK_ERROR = 'Could not reach the server. Check your connection and try again.';

describe('submitPaymentOrQueue', () => {
  it('returns the server response directly on success — nothing queued', async () => {
    api.post.mockResolvedValueOnce({ transactionId: 'tx1' });
    const result = await submitPaymentOrQueue('/payments', { idempotency_key: 'k1', amount: 100 });
    expect(result).toEqual({ queued: false, data: { transactionId: 'tx1' } });
    expect(getQueueCount()).toBe(0);
  });

  it('queues the payload on a genuine network failure', async () => {
    api.post.mockRejectedValueOnce(new Error(NETWORK_ERROR));
    const result = await submitPaymentOrQueue('/payments', { idempotency_key: 'k1', amount: 100 }, { borrowerName: 'Bandara' });
    expect(result).toEqual({ queued: true });
    expect(getQueueCount()).toBe(1);
    expect(getQueuedPayments()[0]).toMatchObject({
      id: 'k1',
      endpoint: '/payments',
      payload: { idempotency_key: 'k1', amount: 100 },
      meta: { borrowerName: 'Bandara' },
    });
  });

  // The critical safety property: a real server rejection (wrong amount,
  // loan already paid off, expired token, ...) must NEVER be silently
  // queued as if it were just a connectivity problem — that would hide a
  // genuine error behind a false "saved, will sync" message.
  it('rethrows (and does NOT queue) any error that is not the network-failure message', async () => {
    api.post.mockRejectedValueOnce(new Error('Interest payment (LKR 600) exceeds outstanding interest due (LKR 500).'));
    await expect(
      submitPaymentOrQueue('/payments', { idempotency_key: 'k2', amount: 600 })
    ).rejects.toThrow('exceeds outstanding interest due');
    expect(getQueueCount()).toBe(0);
  });

  it('falls back to a locally-generated id when the payload has no idempotency_key', async () => {
    api.post.mockRejectedValueOnce(new Error(NETWORK_ERROR));
    await submitPaymentOrQueue('/loans/loan1/daily-collection', { status: 'paid', amount: 500 });
    expect(getQueuedPayments()[0].id).toMatch(/^local_/);
  });
});

describe('syncQueuedPayments', () => {
  it('removes and reports successfully synced items', async () => {
    api.post.mockRejectedValueOnce(new Error(NETWORK_ERROR));
    await submitPaymentOrQueue('/payments', { idempotency_key: 'a', amount: 100 });
    api.post.mockResolvedValueOnce({ transactionId: 'tx-a' });

    const result = await syncQueuedPayments();
    expect(result.synced).toHaveLength(1);
    expect(result.synced[0].id).toBe('a');
    expect(result.remaining).toBe(0);
    expect(getQueueCount()).toBe(0);
  });

  it('stops at the first item that is still a network failure, leaving the rest queued for next time', async () => {
    api.post.mockRejectedValue(new Error(NETWORK_ERROR));
    await submitPaymentOrQueue('/payments', { idempotency_key: 'a', amount: 100 });
    await submitPaymentOrQueue('/payments', { idempotency_key: 'b', amount: 200 });

    const result = await syncQueuedPayments();
    expect(result.synced).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(result.remaining).toBe(2); // still offline — nothing removed
  });

  it('treats an "already been recorded" duplicate response as a successful sync, not a failure', async () => {
    api.post.mockRejectedValueOnce(new Error(NETWORK_ERROR));
    await submitPaymentOrQueue('/payments', { idempotency_key: 'a', amount: 100 });
    // Simulates: an earlier sync attempt actually succeeded server-side,
    // but the client crashed/closed before it could clear the queue entry.
    api.post.mockRejectedValueOnce(new Error('This payment has already been recorded (Duplicate transaction detected).'));

    const result = await syncQueuedPayments();
    expect(result.synced).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
    expect(getQueueCount()).toBe(0);
  });

  it('drops (does not retry forever) an item that fails for a real, non-network reason', async () => {
    api.post.mockRejectedValueOnce(new Error(NETWORK_ERROR));
    await submitPaymentOrQueue('/payments', { idempotency_key: 'a', amount: 100 });
    api.post.mockRejectedValueOnce(new Error('This loan has already been fully paid.'));

    const result = await syncQueuedPayments();
    expect(result.synced).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].message).toMatch(/fully paid/);
    expect(getQueueCount()).toBe(0); // removed, not left to retry forever
  });
});

describe('removeFromQueue', () => {
  it('removes only the matching id', async () => {
    api.post.mockRejectedValue(new Error(NETWORK_ERROR));
    await submitPaymentOrQueue('/payments', { idempotency_key: 'a', amount: 100 });
    await submitPaymentOrQueue('/payments', { idempotency_key: 'b', amount: 200 });

    removeFromQueue('a');
    expect(getQueueCount()).toBe(1);
    expect(getQueuedPayments()[0].id).toBe('b');
  });
});
