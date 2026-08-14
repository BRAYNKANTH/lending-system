/**
 * Pure, DB-free money-math functions used by the interest accrual and
 * payment-collection services (interest.js / ledger.js). Extracted so the
 * arithmetic that actually decides real balances can be unit tested without
 * spinning up Postgres — the DB-touching code in those two files just calls
 * these and persists the result.
 *
 * Nothing in this file talks to the database, reads env vars, or has side
 * effects — every function is a straight input -> output (or throws).
 */

// ---------------------------------------------------------------------------
// Loan reference numbers (see src/app/api/loans/route.js)
// ---------------------------------------------------------------------------

/**
 * Computes the next sequential reference number from the highest existing
 * numeric suffix, NOT from a row count — a row count breaks the instant
 * history has any gap (a deleted loan, a never-issued number), producing a
 * duplicate that collides with the unique constraint on every subsequent
 * attempt. This is the exact fix from the 2026-08-14 production incident
 * (STN-001 missing from history, COUNT(*)+1 permanently stuck on STN-056).
 *
 * @param {string} prefix - org's reference prefix, e.g. 'STN'
 * @param {number|string|null|undefined} maxExistingNum - MAX(numeric suffix) across existing reference numbers, or null/undefined if none exist yet
 */
export function nextReferenceNumber(prefix, maxExistingNum) {
  const nextSequence = (parseInt(maxExistingNum, 10) || 0) + 1;
  return `${prefix}-${String(nextSequence).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Interest accrual (see src/lib/services/interest.js)
// ---------------------------------------------------------------------------

/**
 * Interest owed for a single accrual period, derived from the loan's
 * monthly rate. Daily/weekly loans divide the same monthly figure down
 * (by 30 and 4 respectively) rather than using a separate rate field.
 */
export function calculateInterestPerPeriod(principal, rate, interestType) {
  const monthlyInterest = principal * (rate / 100);
  if (interestType === 'daily') return monthlyInterest / 30;
  if (interestType === 'weekly') return monthlyInterest / 4;
  return monthlyInterest; // monthly (and fallback)
}

/**
 * Advances a date forward by one accrual period for the given interest
 * type, then re-aligns to midnight (matching the original inline loop's
 * `nextDate.setHours(0,0,0,0)` after every step). Returns a NEW Date —
 * never mutates the one passed in.
 *
 * Returns null for an unrecognized interest_type, signaling "stop" to the
 * caller — same as the original loop's unconditional `break` in that case.
 */
export function advanceAccrualDate(date, interestType) {
  const next = new Date(date);
  if (interestType === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (interestType === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (interestType === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  } else {
    return null;
  }
  next.setHours(0, 0, 0, 0);
  return next;
}

/**
 * Walks forward from `nextAccrualDate` accruing one `interestPerPeriod` for
 * every period that has come due as of `now`, catching up on however many
 * periods were missed (capped at `maxPeriods` as a sanity ceiling against a
 * corrupted next_accrual_date) — same "catch up in one pass" behavior as
 * the original inline while-loop in runInterestAccruals.
 *
 * @returns {{ periods: {date: Date, amount: number}[], totalAccrued: number, runningInterestBalance: number, nextAccrualDate: Date }}
 *   `periods` — one entry per accrued period, in order (for building the
 *   per-period interest_accruals audit rows exactly as before).
 */
export function computeAccrualBatch({
  interestType,
  interestPerPeriod,
  startingInterestBalance,
  nextAccrualDate,
  now,
  maturityDate,
  maxPeriods = 500,
}) {
  const periods = [];
  let totalAccrued = 0;
  let runningInterestBalance = startingInterestBalance;
  let cursor = new Date(nextAccrualDate);
  const nowDate = new Date(now);
  const maturity = maturityDate ? new Date(maturityDate) : null;

  while (cursor <= nowDate && periods.length < maxPeriods) {
    if (maturity && cursor > maturity) break;

    runningInterestBalance += interestPerPeriod;
    totalAccrued += interestPerPeriod;
    periods.push({ date: new Date(cursor), amount: interestPerPeriod });

    const next = advanceAccrualDate(cursor, interestType);
    if (next === null) break; // unknown interest_type — avoid an infinite loop
    cursor = next;
  }

  return { periods, totalAccrued, runningInterestBalance, nextAccrualDate: cursor };
}

// ---------------------------------------------------------------------------
// Payment collection (see src/lib/services/ledger.js)
// ---------------------------------------------------------------------------

const NOT_PAYABLE_MESSAGES = {
  fully_paid: 'This loan has already been fully paid.',
  written_off: 'This loan has been written off as bad debt and no longer accepts payments.',
  defaulted: "This loan is defaulted. Reinstate it first (Admin > Reinstate Loan) before recording a payment.",
  pending: 'This loan application is still awaiting admin approval and has not been disbursed yet.',
  rejected: 'This loan application was rejected and was never disbursed.',
};

/** Throws with the exact same message the original inline status checks used, or returns silently if payable. */
export function assertLoanIsPayable(status) {
  const message = NOT_PAYABLE_MESSAGES[status];
  if (message) throw new Error(message);
}

/**
 * Validates and computes the new principal/interest/status for a standard
 * (non-flat-installment) interest-only payment. Throws on an invalid
 * amount or payment type instead of returning an error, matching the
 * original inline checks in recordPaymentCollection.
 */
export function computeStandardPayment({ paymentType, payAmount, principalOutstanding, interestBalance }) {
  if (paymentType === 'interest') {
    if (payAmount > interestBalance) {
      throw new Error(`Interest payment (LKR ${payAmount.toLocaleString()}) exceeds outstanding interest due (LKR ${interestBalance.toLocaleString()}).`);
    }
    const newInterestBalance = interestBalance - payAmount;
    return { newPrincipalOutstanding: principalOutstanding, newInterestBalance, newStatus: null };
  }

  if (paymentType === 'principal') {
    if (payAmount > principalOutstanding) {
      throw new Error(`Principal payment (LKR ${payAmount.toLocaleString()}) exceeds outstanding principal (LKR ${principalOutstanding.toLocaleString()}).`);
    }
    const newPrincipalOutstanding = principalOutstanding - payAmount;
    const newStatus = newPrincipalOutstanding <= 0 ? 'fully_paid' : null;
    return { newPrincipalOutstanding, newInterestBalance: interestBalance, newStatus };
  }

  throw new Error("Payment type must be 'interest' or 'principal'.");
}

/**
 * Splits a flat daily installment collection proportionally between
 * principal and interest using the loan's fixed per-day ratio, capping
 * each side at what's actually still owed on it (the last collection of
 * the term, or an odd partial amount, can otherwise push one side
 * slightly negative from rounding or uneven paydown). Mirrors
 * recordFlatInstallmentCollection's split logic exactly.
 */
export function computeFlatInstallmentSplit({ payAmount, principalOutstanding, interestBalance, principalPerDay, dailyInstallmentAmount }) {
  const dailyInstallment = dailyInstallmentAmount || (principalPerDay + 0);
  const principalRatio = dailyInstallment > 0 ? principalPerDay / dailyInstallment : 0;

  let principalPortion = payAmount * principalRatio;
  let interestPortion = payAmount - principalPortion;

  if (principalPortion > principalOutstanding) {
    interestPortion += principalPortion - principalOutstanding;
    principalPortion = principalOutstanding;
  }
  if (interestPortion > interestBalance) {
    principalPortion += interestPortion - interestBalance;
    interestPortion = interestBalance;
  }
  principalPortion = Math.min(principalPortion, principalOutstanding);
  interestPortion = Math.min(interestPortion, interestBalance);

  return { principalPortion, interestPortion };
}
