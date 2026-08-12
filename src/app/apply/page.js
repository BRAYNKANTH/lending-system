'use client';

import dynamic from 'next/dynamic';

// Public borrower-intake form — standalone from the main authenticated app
// (client-only for the same reason as the main page.js: reads window/fetch
// at render time and has no need to be server-rendered or bundled with the
// full LendApp tree).
const BorrowerIntakeForm = dynamic(() => import('@/components/BorrowerIntakeForm.jsx'), { ssr: false });

export default function ApplyPage() {
  return <BorrowerIntakeForm />;
}
