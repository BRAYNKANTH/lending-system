export function isValidSriLankanNIC(nic) {
  const cleaned = nic.trim().toUpperCase();
  return /^[0-9]{9}[VX]$/.test(cleaned) || /^[0-9]{12}$/.test(cleaned);
}

export function addInterval(date, interestType, count = 1) {
  const result = new Date(date);
  if (interestType === 'monthly') {
    result.setMonth(result.getMonth() + count);
  } else {
    const days = interestType === 'daily' ? 1 : 7;
    result.setDate(result.getDate() + days * count);
  }
  result.setHours(0, 0, 0, 0); // Align to midnight when the date changes
  return result;
}
