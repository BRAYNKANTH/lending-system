import { Inter, Outfit } from 'next/font/google';
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

export const metadata = {
  title: 'STN MICRO CREDIT',
  description: 'Cash Lending & Agent Collection Management System',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png'
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'STN Credit'
  }
};

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
