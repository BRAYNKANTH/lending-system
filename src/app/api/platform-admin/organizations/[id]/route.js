import { NextResponse } from 'next/server';
import platformDb from '@/lib/platformDb.js';
import { requirePlatformAuth, PlatformAuthError } from '@/lib/platformAuth.js';

const EDITABLE_FIELDS = [
  'name', 'logo_url', 'primary_color', 'contact_name', 'contact_email',
  'contact_phone', 'database_url', 'custom_domain', 'status', 'notes'
];

export async function GET(request, { params }) {
  try {
    await requirePlatformAuth(request);
    const org = await platformDb('organizations').where({ id: params.id }).first();
    if (!org) return NextResponse.json({ message: 'Organization not found.' }, { status: 404 });
    return NextResponse.json({ organization: org });
  } catch (error) {
    if (error instanceof PlatformAuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Get organization error:', error);
    return NextResponse.json({ message: 'Internal server error while fetching the organization.' }, { status: 500 });
  }
}

// Partial update — only the fields present in the request body are
// touched, so the edit form can submit just what changed (e.g. flipping
// status to 'suspended') without having to resend every field.
export async function PATCH(request, { params }) {
  try {
    await requirePlatformAuth(request);
    const body = await request.json();

    if (body.status && !['active', 'trial', 'suspended'].includes(body.status)) {
      return NextResponse.json({ message: "Status must be 'active', 'trial', or 'suspended'." }, { status: 400 });
    }
    if (body.name !== undefined && !body.name.trim()) {
      return NextResponse.json({ message: 'Organization name cannot be blank.' }, { status: 400 });
    }

    const updates = {};
    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) updates[field] = body[field] === '' ? null : body[field];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'No editable fields provided.' }, { status: 400 });
    }
    updates.updated_at = platformDb.fn.now();

    const [org] = await platformDb('organizations').where({ id: params.id }).update(updates).returning('*');
    if (!org) return NextResponse.json({ message: 'Organization not found.' }, { status: 404 });

    return NextResponse.json({ message: 'Organization updated.', organization: org });
  } catch (error) {
    if (error instanceof PlatformAuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Update organization error:', error);
    return NextResponse.json({ message: 'Internal server error while updating the organization.' }, { status: 500 });
  }
}
