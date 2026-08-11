import { Inter, Outfit } from 'next/font/google';
import db from '@/lib/db.js';
import './globals.css';

// Self-hosted at build time (no request to fonts.googleapis.com at runtime)
// — Next.js downloads these once during build and serves them from this
// app's own domain. Replaces a render-blocking `@import` that used to sit
// at the top of globals.css and cost every page load an extra network
// round-trip before anything could paint. Weights match what was
// previously requested from Google Fonts.
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap'
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap'
});

// Reads this org's own name from its own database for the browser tab
// title — same org_settings row the app itself reads via GET /api/settings
// (see src/app/api/settings/route.js). Falls back to a generic title
// rather than throwing if DATABASE_URL isn't set at all, which is exactly
// the case for the dedicated /platform-admin deployment: this root layout
// wraps every route in the app, including that one, and that deployment
// deliberately has no DATABASE_URL (only PLATFORM_DATABASE_URL) — see
// src/lib/platformDb.js. The icon/PWA assets stay static build-time
// files rather than per-org, since changing those needs different actual
// image files per deployment, not just a database row.
export async function generateMetadata() {
  let orgName = 'Cash Lending Management System';
  try {
    if (process.env.DATABASE_URL) {
      const settings = await db('org_settings').first();
      if (settings?.org_name) orgName = settings.org_name;
    }
  } catch {
    // DB unreachable at build/request time — fall back silently, a wrong
    // tab title is never worth failing the page over.
  }

  return {
    title: orgName.toUpperCase(),
    description: 'Cash Lending & Agent Collection Management System',
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [
        { url: '/stn_emblem.png?v=2', type: 'image/png' },
        { url: '/favicon.ico?v=2' }
      ],
      shortcut: '/stn_emblem.png?v=2',
      apple: '/icons/apple-touch-icon.png?v=2'
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: orgName
    }
  };
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2554e8',
  viewportFit: 'cover'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body>{children}</body>
    </html>
  );
}
