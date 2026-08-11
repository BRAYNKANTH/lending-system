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

// Forces this layout (and the metadata below) to be rendered per-request
// rather than baked into a static HTML shell at build time — without
// this, Next prerenders the page once at build time with whatever was in
// the database THEN, so an admin changing the org name/logo in Settings
// wouldn't show up in the browser tab title or favicon until the next
// deploy, breaking the "no redeploy needed" point of this whole feature
// (the in-app header/login already update instantly since those are
// fetched client-side, but this server-rendered metadata needs the same
// opt-out explicitly).
export const dynamic = 'force-dynamic';

// Reads this org's own name from its own database for the browser tab
// title — same org_settings row the app itself reads via GET /api/settings
// (see src/app/api/settings/route.js). Falls back to a generic title
// rather than throwing if DATABASE_URL isn't set at all, which is exactly
// the case for the dedicated /platform-admin deployment: this root layout
// wraps every route in the app, including that one, and that deployment
// deliberately has no DATABASE_URL (only PLATFORM_DATABASE_URL) — see
// src/lib/platformDb.js.
//
// Favicon/apple-touch-icon point at /api/org-icon (see that route) instead
// of the old static per-file STN icons — it resizes/pads THIS org's own
// uploaded logo (or a neutral placeholder if none is set yet) to whatever
// size each icon slot needs, using sharp. The PWA manifest itself is
// src/app/manifest.js, a Next.js special file Next auto-links on its own
// — no `manifest:` entry needed here.
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
    icons: {
      icon: [
        { url: '/api/org-icon?size=32', type: 'image/png', sizes: '32x32' },
        { url: '/api/org-icon?size=192', type: 'image/png', sizes: '192x192' }
      ],
      shortcut: '/api/org-icon?size=48',
      apple: '/api/org-icon?size=180'
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
