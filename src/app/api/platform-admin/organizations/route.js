import { NextResponse } from 'next/server';
import platformDb from '@/lib/platformDb.js';
import { requirePlatformAuth, PlatformAuthError } from '@/lib/platformAuth.js';

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

// List every organization in the registry. This is an internal ops tool —
// the database_url is deliberately included here (unlike a public-facing
// API) since the whole point of this screen is to give the platform owner
// that connection info at a glance; access is gated behind platform-admin
// auth, not exposed to any tenant-app user.
export async function GET(request) {
  try {
    await requirePlatformAuth(request);
    const orgs = await platformDb('organizations').orderBy('created_at', 'desc');
    return NextResponse.json({ organizations: orgs });
  } catch (error) {
    if (error instanceof PlatformAuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('List organizations error:', error);
    return NextResponse.json({ message: 'Internal server error while listing organizations.' }, { status: 500 });
  }
}

// Registers a new organization in the platform registry. This does NOT
// create the org's Supabase project or run their database migration — per
// the deliberate "registry only" scope, the platform owner creates the
// Supabase project and runs `npm run db:migrate` against it themselves
// (same as onboarding today), then pastes the resulting connection string
// in here purely for tracking/reference.
export async function POST(request) {
  try {
    await requirePlatformAuth(request);
    const body = await request.json();
    const { name, logo_url, primary_color, contact_name, contact_email, contact_phone, database_url, custom_domain, status, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ message: 'Organization name is required.' }, { status: 400 });
    }

    let slug = slugify(name);
    if (!slug) {
      return NextResponse.json({ message: 'Organization name must contain at least one letter or number.' }, { status: 400 });
    }
    const existing = await platformDb('organizations').where({ slug }).first();
    if (existing) {
      // Keep it simple and deterministic rather than silently colliding —
      // append a short suffix so two orgs with similar names both get a
      // usable, unique slug without the caller having to retry.
      slug = `${slug}-${Date.now().toString(36).slice(-5)}`;
    }

    if (status && !['active', 'trial', 'suspended'].includes(status)) {
      return NextResponse.json({ message: "Status must be 'active', 'trial', or 'suspended'." }, { status: 400 });
    }

    const [org] = await platformDb('organizations')
      .insert({
        name: name.trim(),
        slug,
        logo_url: logo_url || null,
        primary_color: primary_color || null,
        contact_name: contact_name || null,
        contact_email: contact_email || null,
        contact_phone: contact_phone || null,
        database_url: database_url || null,
        custom_domain: custom_domain || null,
        status: status || 'active',
        notes: notes || null
      })
      .returning('*');

    return NextResponse.json({ message: 'Organization created.', organization: org }, { status: 201 });
  } catch (error) {
    if (error instanceof PlatformAuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Create organization error:', error);
    return NextResponse.json({ message: 'Internal server error while creating the organization.' }, { status: 500 });
  }
}
