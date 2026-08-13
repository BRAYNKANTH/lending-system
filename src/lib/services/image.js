const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB decoded

/**
 * Validates a base64 image data URL (NIC photo / payment proof) and returns
 * it unchanged for storage directly in the database — Vercel's serverless
 * filesystem is read-only/ephemeral, so images can't be written to disk the
 * way the original Express app did. Returns null if missing or invalid.
 */
export function validateImageDataUrl(base64Data) {
  if (!base64Data || typeof base64Data !== 'string' || !base64Data.startsWith('data:image')) {
    return null;
  }

  const match = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!match) return null;

  const [, mimeType, data] = match;
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return null;

  const approxBytes = Math.ceil((data.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) return null;

  return base64Data;
}

export const MAX_PHOTOS_PER_FIELD = 4;

/**
 * Validates an array of up to MAX_PHOTOS_PER_FIELD base64 image data URLs
 * (e.g. NIC photo or Photo Proof, now multi-file). Returns the validated
 * array, or null if the input isn't a non-empty array, has too many items,
 * or any single item fails validateImageDataUrl.
 */
export function validateImageDataUrlArray(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  if (items.length > MAX_PHOTOS_PER_FIELD) return null;

  const validated = [];
  for (const item of items) {
    const url = validateImageDataUrl(item);
    if (!url) return null;
    validated.push(url);
  }
  return validated;
}
