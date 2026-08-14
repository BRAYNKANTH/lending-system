import { describe, it, expect } from 'vitest';
import {
  nextReferenceNumber,
  calculateInterestPerPeriod,
  advanceAccrualDate,
  computeAccrualBatch,
  assertLoanIsPayable,
  computeStandardPayment,
  computeFlatInstallmentSplit,
} from './loanMath.js';

describe('nextReferenceNumber', () => {
  it('increments from the max existing number', () => {
    expect(nextReferenceNumber('STN', 56)).toBe('STN-057');
  });

  it('starts at 001 when there is no existing loan', () => {
    expect(nextReferenceNumber('STN', null)).toBe('STN-001');
    expect(nextReferenceNumber('STN', undefined)).toBe('STN-001');
  });

  // Regression test for the actual 2026-08-14 production incident: loan
  // count was 55 (STN-001 permanently missing from history), so the old
  // COUNT(*)+1 approach kept computing 56 and colliding with the loan that
  // already holds STN-056 on every single attempt. MAX-based generation
  // must be immune to gaps anywhere in the history.
  it('is unaffected by a gap in reference number history (regression: STN-001 missing, 55 loans on record, highest is STN-056)', () => {
    // COUNT(*) would have been 55 here -> COUNT+1 = 56 -> collides with STN-056.
    expect(nextReferenceNumber('STN', 56)).toBe('STN-057');
    expect(nextReferenceNumber('STN', 56)).not.toBe('STN-056');
  });

  it('pads sequence numbers under 100 to 3 digits', () => {
    expect(nextReferenceNumber('LN', 4)).toBe('LN-005');
  });

  it('does not truncate 4+ digit sequences', () => {
    expect(nextReferenceNumber('STN', 999)).toBe('STN-1000');
  });
});

describe('calculateInterestPerPeriod', () => {
  it('divides the monthly rate by 30 for daily loans', () => {
    // 100,000 principal @ 2% monthly = 2,000/month -> 66.666.../day
    expect(calculateInterestPerPeriod(100000, 2, 'daily')).toBeCloseTo(66.6667, 3);
  });

  it('divides the monthly rate by 4 for weekly loans', () => {
    expect(calculateInterestPerPeriod(100000, 2, 'weekly')).toBeCloseTo(500, 6);
  });

  it('uses the monthly rate as-is for monthly loans', () => {
    expect(calculateInterestPerPeriod(100000, 2, 'monthly')).toBe(2000);
  });

  it('treats an unrecognized interest type as monthly (same as the original fallback)', () => {
    expect(calculateInterestPerPeriod(100000, 2, 'fortnightly')).toBe(2000);
  });

  it('returns 0 interest on a 0% rate', () => {
    expect(calculateInterestPerPeriod(100000, 0, 'daily')).toBe(0);
  });
});

describe('advanceAccrualDate', () => {
  it('advances daily loans by 1 day and re-aligns to midnight', () => {
    const next = advanceAccrualDate(new Date('2026-08-14T15:42:00Z'), 'daily');
    expect(next.getDate()).toBe(15);
    expect(next.getHours()).toBe(0);
    expect(next.getMinutes()).toBe(0);
  });

  it('advances weekly loans by 7 days', () => {
    const next = advanceAccrualDate(new Date('2026-08-01T00:00:00'), 'weekly');
    expect(next.getDate()).toBe(8);
  });

  it('advances monthly loans by 1 calendar month', () => {
    const next = advanceAccrualDate(new Date('2026-01-31T00:00:00'), 'monthly');
    // JS Date rolls Jan 31 + 1 month into Mar 2/3 (Feb has no 31st) —
    // documenting actual behavior, not asserting an "ideal" one.
    expect(next.getMonth()).toBe(2); // March
  });

  it('returns null for an unrecognized interest type instead of looping forever', () => {
    expect(advanceAccrualDate(new Date(), 'fortnightly')).toBeNull();
  });

  it('never mutates the date passed in', () => {
    const original = new Date('2026-08-14T00:00:00');
    const originalTime = original.getTime();
    advanceAccrualDate(original, 'daily');
    expect(original.getTime()).toBe(originalTime);
  });
});

describe('computeAccrualBatch', () => {
  it('accrues a single period when exactly one is due', () => {
    // Loop condition is `cursor <= now` (matches the original inline
    // while-loop), so with nextAccrualDate one day before `now`, both the
    // 13th (the due date) and the 14th (equal to `now`) are <= now.
    const result = computeAccrualBatch({
      interestType: 'daily',
      interestPerPeriod: 100,
      startingInterestBalance: 500,
      nextAccrualDate: new Date('2026-08-14T00:00:00'),
      now: new Date('2026-08-14T00:00:00'),
      maturityDate: null,
    });
    expect(result.periods).toHaveLength(1);
    expect(result.totalAccrued).toBe(100);
    expect(result.runningInterestBalance).toBe(600);
  });

  it('catches up on every missed period in one pass (e.g. cron did not run for 4 days)', () => {
    const result = computeAccrualBatch({
      interestType: 'daily',
      interestPerPeriod: 100,
      startingInterestBalance: 0,
      nextAccrualDate: new Date('2026-08-10T00:00:00'),
      now: new Date('2026-08-14T00:00:00'),
      maturityDate: null,
    });
    expect(result.periods).toHaveLength(5); // 10th, 11th, 12th, 13th, 14th are all <= now (14th)
    expect(result.totalAccrued).toBe(500);
    expect(result.runningInterestBalance).toBe(500);
  });

  it('returns zero periods when nothing is due yet', () => {
    const result = computeAccrualBatch({
      interestType: 'daily',
      interestPerPeriod: 100,
      startingInterestBalance: 250,
      nextAccrualDate: new Date('2026-08-20T00:00:00'),
      now: new Date('2026-08-14T00:00:00'),
      maturityDate: null,
    });
    expect(result.periods).toHaveLength(0);
    expect(result.totalAccrued).toBe(0);
    expect(result.runningInterestBalance).toBe(250);
  });

  it('stops at the maturity date even if more periods would otherwise be due', () => {
    const result = computeAccrualBatch({
      interestType: 'daily',
      interestPerPeriod: 100,
      startingInterestBalance: 0,
      nextAccrualDate: new Date('2026-08-10T00:00:00'),
      now: new Date('2026-08-14T00:00:00'),
      maturityDate: new Date('2026-08-11T00:00:00'),
    });
    // Due on the 10th and 11th; the 12th exceeds maturity and is excluded.
    expect(result.periods).toHaveLength(2);
    expect(result.totalAccrued).toBe(200);
  });

  it('caps at maxPeriods as a sanity ceiling against a corrupted next_accrual_date', () => {
    const result = computeAccrualBatch({
      interestType: 'daily',
      interestPerPeriod: 10,
      startingInterestBalance: 0,
      nextAccrualDate: new Date('2000-01-01T00:00:00'), // decades of missed periods
      now: new Date('2026-08-14T00:00:00'),
      maturityDate: null,
      maxPeriods: 500,
    });
    expect(result.periods).toHaveLength(500);
  });
});

describe('assertLoanIsPayable', () => {
  it.each([
    ['fully_paid', /already been fully paid/],
    ['written_off', /written off as bad debt/],
    ['defaulted', /Reinstate it first/],
    ['pending', /awaiting admin approval/],
    ['rejected', /was rejected/],
  ])('throws for status "%s"', (status, expectedMessage) => {
    expect(() => assertLoanIsPayable(status)).toThrow(expectedMessage);
  });

  it('does not throw for an active loan', () => {
    expect(() => assertLoanIsPayable('active')).not.toThrow();
  });
});

describe('computeStandardPayment', () => {
  it('applies an interest payment without touching principal', () => {
    const result = computeStandardPayment({
      paymentType: 'interest', payAmount: 300, principalOutstanding: 100000, interestBalance: 500,
    });
    expect(result).toEqual({ newPrincipalOutstanding: 100000, newInterestBalance: 200, newStatus: null });
  });

  it('rejects an interest payment larger than the outstanding interest', () => {
    expect(() => computeStandardPayment({
      paymentType: 'interest', payAmount: 600, principalOutstanding: 100000, interestBalance: 500,
    })).toThrow(/exceeds outstanding interest due/);
  });

  it('applies a partial principal payment without closing the loan', () => {
    const result = computeStandardPayment({
      paymentType: 'principal', payAmount: 40000, principalOutstanding: 100000, interestBalance: 500,
    });
    expect(result).toEqual({ newPrincipalOutstanding: 60000, newInterestBalance: 500, newStatus: null });
  });

  it('marks the loan fully_paid when a principal payment clears the balance exactly', () => {
    const result = computeStandardPayment({
      paymentType: 'principal', payAmount: 100000, principalOutstanding: 100000, interestBalance: 0,
    });
    expect(result.newPrincipalOutstanding).toBe(0);
    expect(result.newStatus).toBe('fully_paid');
  });

  it('rejects a principal payment larger than what is outstanding', () => {
    expect(() => computeStandardPayment({
      paymentType: 'principal', payAmount: 150000, principalOutstanding: 100000, interestBalance: 0,
    })).toThrow(/exceeds outstanding principal/);
  });

  it('rejects an unrecognized payment type', () => {
    expect(() => computeStandardPayment({
      paymentType: 'fee', payAmount: 100, principalOutstanding: 100000, interestBalance: 0,
    })).toThrow(/must be 'interest' or 'principal'/);
  });
});

describe('computeFlatInstallmentSplit', () => {
  it('splits proportionally using the fixed per-day ratio', () => {
    // 700/day installment: 500 principal + 200 interest per day (ratio 5/7)
    const result = computeFlatInstallmentSplit({
      payAmount: 700, principalOutstanding: 15000, interestBalance: 6000,
      principalPerDay: 500, dailyInstallmentAmount: 700,
    });
    expect(result.principalPortion).toBeCloseTo(500, 6);
    expect(result.interestPortion).toBeCloseTo(200, 6);
  });

  it('caps the principal portion at what remains outstanding on the final/odd collection', () => {
    // Only 200 principal left, but the day's installment would normally put 500 toward it.
    const result = computeFlatInstallmentSplit({
      payAmount: 700, principalOutstanding: 200, interestBalance: 6000,
      principalPerDay: 500, dailyInstallmentAmount: 700,
    });
    expect(result.principalPortion).toBe(200);
    expect(result.interestPortion).toBe(500); // the excess 300 rolls onto interest
  });

  it('caps the interest portion at what remains outstanding', () => {
    const result = computeFlatInstallmentSplit({
      payAmount: 700, principalOutstanding: 15000, interestBalance: 100,
      principalPerDay: 500, dailyInstallmentAmount: 700,
    });
    expect(result.interestPortion).toBe(100);
    expect(result.principalPortion).toBe(600); // the excess 100 rolls onto principal
  });

  it('never lets either portion go negative when both caps apply on a tiny final payment', () => {
    const result = computeFlatInstallmentSplit({
      payAmount: 50, principalOutstanding: 30, interestBalance: 15,
      principalPerDay: 500, dailyInstallmentAmount: 700,
    });
    expect(result.principalPortion).toBeGreaterThanOrEqual(0);
    expect(result.interestPortion).toBeGreaterThanOrEqual(0);
    expect(result.principalPortion).toBeLessThanOrEqual(30);
    expect(result.interestPortion).toBeLessThanOrEqual(15);
  });

  it('treats a zero dailyInstallmentAmount as a 0% principal ratio instead of dividing by zero', () => {
    const result = computeFlatInstallmentSplit({
      payAmount: 100, principalOutstanding: 5000, interestBalance: 5000,
      principalPerDay: 0, dailyInstallmentAmount: 0,
    });
    expect(Number.isFinite(result.principalPortion)).toBe(true);
    expect(Number.isFinite(result.interestPortion)).toBe(true);
  });
});
