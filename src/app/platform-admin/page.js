'use client';

import dynamic from 'next/dynamic';

// Same reasoning as src/app/page.js: reads localStorage synchronously
// during render, so it can't be server-rendered.
const PlatformAdminApp = dynamic(() => import('@/components/PlatformAdminApp.jsx'), { ssr: false });

export default function PlatformAdminPage() {
  return <PlatformAdminApp />;
}
