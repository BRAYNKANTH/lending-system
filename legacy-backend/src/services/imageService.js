import fs from 'fs';
import path from 'path';

// Only raster image formats are accepted — SVG is deliberately excluded
// because it can carry embedded <script>/onload payloads (stored XSS risk
// when served back to browsers from /uploads).
const ALLOWED_MIME_TO_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp'
};
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB

/**
 * Saves a base64 encoded image to the uploads directory.
 * @param {string} base64Data - Base64 image data URL (e.g. data:image/png;base64,...)
 * @param {string} prefix - Filename prefix (e.g., 'nic', 'payment')
 * @returns {string|null} Relative web-accessible URL of the saved file, or null
 */
export function saveBase64Image(base64Data, prefix) {
  if (!base64Data || !base64Data.startsWith('data:image')) {
    return null;
  }

  try {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return null;
    }

    const mimeType = matches[1].toLowerCase();
    const extension = ALLOWED_MIME_TO_EXT[mimeType];
    if (!extension) {
      console.error(`Rejected image upload: unsupported MIME type '${mimeType}'.`);
      return null;
    }

    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length > MAX_IMAGE_BYTES) {
      console.error(`Rejected image upload: ${buffer.length} bytes exceeds ${MAX_IMAGE_BYTES} byte limit.`);
      return null;
    }

    const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(uploadDir, filename), buffer);
    return `/uploads/${filename}`;
  } catch (error) {
    console.error('Failed to save base64 image to disk:', error);
    return null;
  }
}
