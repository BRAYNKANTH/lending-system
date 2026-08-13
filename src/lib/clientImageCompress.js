// Client-side only (uses Canvas/Image/FileReader — browser APIs, so this
// must only be imported from 'use client' components). Downscales + JPEG-
// compresses an image file before it becomes a base64 data URL, so a
// multi-photo field (NIC Photo / Photo Proof, up to MAX_KYC_PHOTOS each)
// doesn't balloon payload size the way several raw phone-camera photos
// would. Used by the public /apply intake form; the staff Give Loan wizard
// (LendApp.jsx) has its own copy of the same logic predating this module.
export const MAX_KYC_PHOTOS = 4;

export function compressImageFile(file, maxDim = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a valid image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height / width) * maxDim);
            width = maxDim;
          } else {
            width = Math.round((width / height) * maxDim);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Reads + compresses every file in `fileList`, then calls `updateArrayFn`
// with a (prevArray => nextArray) updater so the caller can plug it into
// whatever state shape it needs (top-level form field vs. one guarantor
// slot). Caps the combined total at MAX_KYC_PHOTOS and reports via
// `onOverflow` if anything had to be dropped to fit.
export async function appendCompressedPhotos(fileList, updateArrayFn, onOverflow) {
  const files = Array.from(fileList || []);
  if (files.length === 0) return;
  const compressed = await Promise.all(files.map((f) => compressImageFile(f)));
  let overflowed = false;
  updateArrayFn((prevArray) => {
    const combined = [...(prevArray || []), ...compressed];
    if (combined.length > MAX_KYC_PHOTOS) overflowed = true;
    return combined.slice(0, MAX_KYC_PHOTOS);
  });
  if (overflowed && onOverflow) onOverflow();
}
