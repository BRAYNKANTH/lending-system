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
