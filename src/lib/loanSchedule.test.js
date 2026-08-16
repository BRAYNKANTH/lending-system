import { describe, it, expect } from 'vitest';
import { isValidSriLankanNIC, getSriLankaTodayRange, addInterval } from './loanSchedule.js';

describe('isValidSriLankanNIC', () => {
  it('accepts the old 9-digit + V/X format', () => {
    expect(isValidSriLankanNIC('123456789V')).toBe(true);
    expect(isValidSriLankanNIC('123456789X')).toBe(true);
  });

  it('accepts lowercase v/x by uppercasing first', () => {
    expect(isValidSriLankanNIC('123456789v')).toBe(true);
  });

  it('accepts the new 12-digit format', () => {
    expect(isValidSriLankanNIC('199012345678')).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(isValidSriLankanNIC('  123456789V  ')).toBe(true);
  });

  it('rejects wrong digit counts for either format', () => {
    expect(isValidSriLankanNIC('12345678V')).toBe(false); // 8 digits + V
    expect(isValidSriLankanNIC('1234567890V')).toBe(false); // 10 digits + V
    expect(isValidSriLankanNIC('19901234567')).toBe(false); // 11 digits
    expect(isValidSriLankanNIC('1990123456789')).toBe(false); // 13 digits
  });

  it('rejects a 12-digit string with a trailing letter (not a real format)', () => {
    expect(isValidSriLankanNIC('19901234567V')).toBe(false);
  });

  it('rejects non-numeric junk', () => {
    expect(isValidSriLankanNIC('ABCDEFGHIJKL')).toBe(false);
    expect(isValidSriLankanNIC('')).toBe(false);
  });
});

describe('getSriLankaTodayRange', () => {
  it('returns a 24-hour window', () => {
    const { start, end } = getSriLankaTodayRange(new Date('2026-08-14T10:00:00Z'));
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  // Sri Lanka is UTC+5:30, so SL midnight = 18:30 UTC the previous day.
  it('starts at 18:30 UTC the previous day, matching Sri Lanka midnight', () => {
    const { start } = getSriLankaTodayRange(new Date('2026-08-14T10:00:00Z')); // 15:30 SL time on the 14th
    expect(start.toISOString()).toBe('2026-08-13T18:30:00.000Z');
  });

  // The whole reason this function exists: a UTC instant that's still
  // "yesterday" by UTC clock time can already be "today" in Sri Lanka.
  // 19:00 UTC on the 13th is 00:30 SL time on the 14th.
  it('treats a late-UTC-evening instant as the next Sri Lankan day', () => {
    const { start } = getSriLankaTodayRange(new Date('2026-08-13T19:00:00Z'));
    expect(start.toISOString()).toBe('2026-08-13T18:30:00.000Z'); // SL midnight on the 14th
  });
});

describe('addInterval', () => {
  it('advances a daily loan by exactly 1 day', () => {
    const next = addInterval(new Date('2026-08-14T10:00:00Z'), 'daily');
    // 2026-08-14T10:00 UTC = 15:30 SL on the 14th; +1 day -> SL midnight on the 15th = 18:30 UTC the 14th.
    expect(next.toISOString()).toBe('2026-08-14T18:30:00.000Z');
  });

  it('advances a weekly loan by exactly 7 days', () => {
    const next = addInterval(new Date('2026-08-01T18:30:00Z'), 'weekly'); // SL midnight, Aug 2
    expect(next.toISOString()).toBe('2026-08-08T18:30:00.000Z'); // SL midnight, Aug 9
  });

  it('advances a monthly loan by 1 calendar month', () => {
    const next = addInterval(new Date('2026-08-01T18:30:00Z'), 'monthly'); // SL midnight, Aug 2
    expect(next.toISOString()).toBe('2026-09-01T18:30:00.000Z'); // SL midnight, Sep 2
  });

  it('honors a count > 1 (used to skip several missed periods at once)', () => {
    const next = addInterval(new Date('2026-08-01T18:30:00Z'), 'daily', 5);
    expect(next.toISOString()).toBe('2026-08-06T18:30:00.000Z');
  });

  it('always aligns the result to Sri Lanka midnight, regardless of the input time-of-day', () => {
    const next = addInterval(new Date('2026-08-14T23:59:00Z'), 'daily'); // 05:29 SL the 15th
    expect(next.toISOString()).toBe('2026-08-15T18:30:00.000Z'); // SL midnight the 16th
  });

  it('does not mutate the date passed in', () => {
    const original = new Date('2026-08-14T10:00:00Z');
    const originalTime = original.getTime();
    addInterval(original, 'daily');
    expect(original.getTime()).toBe(originalTime);
  });
});
