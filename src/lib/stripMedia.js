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
  const { nic_photo_url, address_proof_url, nic_photo_urls, photo_proof_urls, ...rest } = loan;
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

// Same reasoning as stripLoanMedia — the borrower-intake review list can now
// carry a borrower's NIC/photo-proof photos plus up to 2 guarantors' worth
// of the same, and the list view never displays the actual images (only
// "Create Loan from This" needs them, via the full-detail GET). Replaced
// with a _count instead of dropped outright so the review cards can still
// show "3 photos attached" at a glance without shipping the images
// themselves. Guarantor photos are nested inside the guarantors array
// rather than top-level columns, so those get the same treatment per-entry.
export function stripIntakeMedia(intake) {
  if (!intake) return intake;
  const { nic_photo_urls, photo_proof_urls, ...rest } = intake;
  rest.nic_photo_count = Array.isArray(nic_photo_urls) ? nic_photo_urls.length : 0;
  rest.photo_proof_count = Array.isArray(photo_proof_urls) ? photo_proof_urls.length : 0;
  if (Array.isArray(rest.guarantors)) {
    rest.guarantors = rest.guarantors.map((g) => {
      if (!g || typeof g !== 'object') return g;
      const { nic_photo_urls: gNic, photo_proof_urls: gProof, ...gRest } = g;
      gRest.nic_photo_count = Array.isArray(gNic) ? gNic.length : 0;
      gRest.photo_proof_count = Array.isArray(gProof) ? gProof.length : 0;
      return gRest;
    });
  }
  return rest;
}

export function stripIntakeMediaList(intakes) {
  return (intakes || []).map(stripIntakeMedia);
}
