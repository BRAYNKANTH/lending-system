// Removes base64 image fields from list/summary responses. NIC photos and
// payment proof photos are stored directly in Postgres (no file storage on
// Vercel) and can be several MB of base64 text each — fine for a single
// detail view where the image is actually shown, but list endpoints
// (loan list, dashboards, payment history) never display them and were
// shipping every borrower's photo to the browser on every single page
// load. That's the single biggest cause of slow page loads as more loans
// get NIC photos attached — this strips it back out before the response
// leaves the server.
export function stripLoanMedia(loan) {
  if (!loan) return loan;
  const { nic_photo_url, address_proof_url, ...rest } = loan;
  return rest;
}

export function stripLoanMediaList(loans) {
  return (loans || []).map(stripLoanMedia);
}

export function stripTransactionMedia(tx) {
  if (!tx) return tx;
  const { proof_image_url, ...rest } = tx;
  return rest;
}

export function stripTransactionMediaList(transactions) {
  return (transactions || []).map(stripTransactionMedia);
}
