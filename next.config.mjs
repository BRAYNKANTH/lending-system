import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  workboxOptions: {
    skipWaiting: true
  }
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // knex statically requires every dialect it supports (mysql, oracle, etc.)
  // even though this project only uses 'pg' — webpack tries to bundle all of
  // them for API routes and fails on the ones that aren't installed. Marking
  // these external makes Next.js use Node's require at runtime instead,
  // which resolves fine since knex only actually loads the 'pg' dialect.
  experimental: {
    serverComponentsExternalPackages: ['knex', 'pg'],
    // Reduces parallel build-worker processes during static-page generation
    // — each worker is a separate Node process with its own heap, and on a
    // memory-constrained machine spinning up several at once causes OOM
    // crashes mid-build. Harmless on Vercel's build infra (plenty of RAM),
    // just makes local builds slightly more sequential.
    cpus: 1
  }
};

export default withPWA(nextConfig);
