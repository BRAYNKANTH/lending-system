import sharp from 'sharp';
import { readFile } from 'fs/promises';
import path from 'path';
import db from '@/lib/db.js';

// Explicit, matching layout.js and manifest.js — this must read the
// database fresh on every request, not get baked into a static response
// at build time, or a logo change via Settings wouldn't show up until
// the next deploy.
export const dynamic = 'force-dynamic';

// A neutral placeholder — a rounded square with a generic bank/landmark
// glyph in the app's own accent blue — used whenever an organization
// hasn't uploaded a logo yet. Deliberately NOT derived from any specific
// org's branding (the static public/icons/*.png files this route
// replaces were literally baked from STN's logo — falling back to those
// for a different organization would show STN's brand on their PWA icon
// and browser tab, the same mistake already caught once for the header
// logo). Generated as SVG and rasterized by sharp, so there's no bitmap
// asset to accidentally mix up between organizations.
function neutralPlaceholderSvg(size) {
  const r = Math.round(size * 0.18);
  const iconSize = Math.round(size * 0.5);
  const iconOffset = Math.round((size - iconSize) / 2);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${r}" fill="#2554e8"/>
    <g transform="translate(${iconOffset}, ${iconOffset})" fill="#ffffff">
      <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 21h18M4 21V9l8-6 8 6v12M9 21V13h6v8" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </g>
  </svg>`;
}

// Decodes an org's uploaded logo (a data: URL, per the upload form in
// Settings -> Organization), a same-origin path into public/ (e.g. STN's
// original /stn_logo.png, set directly rather than re-uploaded), or a
// fully-external hosted URL — into raw bytes sharp can read. A relative
// path can't just be fetch()'d here: this runs server-side, where fetch
// has no implicit "current page" to resolve a relative URL against (that
// only works client-side, e.g. in an <img> tag or in the browser-only PDF
// generator) — so it's read directly off disk instead, which is also
// faster than a self-referential HTTP round trip would have been.
// Returns null on any failure so the caller can fall back to the neutral
// placeholder rather than erroring the whole response.
async function loadLogoBuffer(logoUrl) {
  try {
    if (logoUrl.startsWith('data:')) {
      const match = logoUrl.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
      if (!match) return null;
      return Buffer.from(match[1], 'base64');
    }
    if (logoUrl.startsWith('/')) {
      const filePath = path.join(process.cwd(), 'public', logoUrl.split('?')[0]);
      return await readFile(filePath);
    }
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// Serves this organization's own logo, resized/padded to whatever square
// size and purpose (browser favicon, apple-touch-icon, or a PWA manifest
// icon — 'any' or 'maskable') the caller needs — one org's logo, read
// from its own database, in place of the old static per-file STN icons.
// `?size=192&purpose=maskable`
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const size = Math.min(1024, Math.max(16, parseInt(searchParams.get('size'), 10) || 512));
  const purpose = searchParams.get('purpose') === 'maskable' ? 'maskable' : 'any';

  let logoBuffer = null;
  if (process.env.DATABASE_URL) {
    try {
      const settings = await db('org_settings').first();
      if (settings?.logo_url) {
        logoBuffer = await loadLogoBuffer(settings.logo_url);
      }
    } catch {
      // DB unreachable — fall through to the neutral placeholder below.
    }
  }

  try {
    let pngBuffer;
    if (logoBuffer) {
      // Maskable icons get cropped into arbitrary shapes (circle, squircle,
      // etc.) by the OS, so the actual logo needs to sit inside a smaller
      // "safe zone" with padding — otherwise corners/edges of the real
      // logo get clipped off. A plain favicon/apple-touch-icon can use the
      // full canvas.
      const contentSize = purpose === 'maskable' ? Math.round(size * 0.7) : size;
      const resizedLogo = await sharp(logoBuffer)
        .resize(contentSize, contentSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .toBuffer();

      pngBuffer = await sharp({
        create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
      })
        .composite([{ input: resizedLogo, gravity: 'center' }])
        .png()
        .toBuffer();
    } else {
      pngBuffer = await sharp(Buffer.from(neutralPlaceholderSvg(size))).png().toBuffer();
    }

    return new Response(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
      }
    });
  } catch (error) {
    console.error('org-icon generation error:', error);
    // Last-resort fallback: the neutral placeholder, never a 500 — a
    // broken favicon request shouldn't be able to break page rendering.
    const fallback = await sharp(Buffer.from(neutralPlaceholderSvg(size))).png().toBuffer();
    return new Response(fallback, { headers: { 'Content-Type': 'image/png' } });
  }
}
