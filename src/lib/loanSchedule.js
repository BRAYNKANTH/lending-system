export function isValidSriLankanNIC(nic) {
  const cleaned = nic.trim().toUpperCase();
  return /^[0-9]{9}[VX]$/.test(cleaned) || /^[0-9]{12}$/.test(cleaned);
}

export function addInterval(date, interestType, count = 1) {
  const result = new Date(date);
  const days = interestType === 'daily' ? 1 : interestType === 'weekly' ? 7 : 30;
  result.setDate(result.getDate() + days * count);
  return result;
}

// Builds a fixed repayment schedule (passbook-style): equal installments
// covering principal + flat-rate interest over the given number of periods.
// This is purely a repayment/tracking overlay — it does not change how or
// when interest is recognized in the ledger; the interest accrual engine
// keeps running independently and, by construction, uses the same
// principal*(rate/100) per-period math, so the two stay in step.
export function buildInstallmentSchedule({ principal, rate, interestType, numInstallments, startDate }) {
  const totalInterest = principal * (rate / 100) * numInstallments;
  const totalRepayable = principal + totalInterest;
  const rawInstallmentAmount = Math.round((totalRepayable / numInstallments) * 100) / 100;

  const installments = [];
  let allocatedSoFar = 0;
  for (let i = 1; i <= numInstallments; i++) {
    const isLast = i === numInstallments;
    const expectedAmount = isLast
      ? Math.round((totalRepayable - allocatedSoFar) * 100) / 100
      : rawInstallmentAmount;
    allocatedSoFar += expectedAmount;
    installments.push({
      installment_number: i,
      due_date: addInterval(startDate, interestType, i),
      expected_amount: expectedAmount
    });
  }

  return { totalInterest, totalRepayable, installmentAmount: rawInstallmentAmount, installments };
}
