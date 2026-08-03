'use client';

import dynamic from 'next/dynamic';

// LendApp reads localStorage/window synchronously during render (ported
// near-verbatim from the original Vite SPA), so it can't be server-rendered
// — load it client-only instead of auditing every usage for SSR-safety.
const LendApp = dynamic(() => import('@/components/LendApp.jsx'), { ssr: false });

export default function Page() {
  return <LendApp />;
}
