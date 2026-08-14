import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { requireAuth, AuthError } from '@/lib/auth.js';
import { validateImageDataUrl } from '@/lib/services/image.js';
import { logError } from '@/lib/logger.js';

// Org branding (name + logo) — deliberately public/unauthenticated on GET,
// since the login screen itself needs to show the org's name and logo
// before anyone has signed in. There's only ever one row (one organization
// per database, per the database-per-tenant architecture), so this always
// returns/updates that single row rather than taking an id.
export async function GET(request) {
  try {
    let settings = await db('org_settings').first();
    if (!settings) {
      // Shouldn't happen post-migration, but fail soft with a sane default
      // rather than a broken login screen if it somehow does.
      settings = { org_name: 'My Organization', logo_url: null, overdue_reminder_threshold_days: 3 };
    }
    return NextResponse.json({
      org_name: settings.org_name,
      logo_url: settings.logo_url,
      overdue_reminder_threshold_days: settings.overdue_reminder_threshold_days
    });
  } catch (error) {
    logError('Get settings error', error, { method: request.method, url: request.url });
    return NextResponse.json({ org_name: 'My Organization', logo_url: null, overdue_reminder_threshold_days: 3 });
  }
}

export async function PATCH(request) {
  try {
    await requireAuth(request, ['admin']);
    const { org_name, logo_url, overdue_reminder_threshold_days } = await request.json();

    const updates = {};
    if (org_name !== undefined) {
      if (!org_name || !org_name.trim()) {
        return NextResponse.json({ message: 'Organization name cannot be blank.' }, { status: 400 });
      }
      updates.org_name = org_name.trim();
    }
    if (logo_url !== undefined) {
      if (logo_url === null || logo_url === '') {
        updates.logo_url = null;
      } else {
        const validated = validateImageDataUrl(logo_url);
        if (!validated) {
          return NextResponse.json({ message: 'Invalid logo image. Use a JPEG, PNG, or WebP under 4MB.' }, { status: 400 });
        }
        updates.logo_url = validated;
      }
    }
    if (overdue_reminder_threshold_days !== undefined) {
      const days = parseInt(overdue_reminder_threshold_days, 10);
      if (isNaN(days) || days < 1) {
        return NextResponse.json({ message: 'Overdue reminder threshold must be a positive number of days.' }, { status: 400 });
      }
      updates.overdue_reminder_threshold_days = days;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'No fields to update.' }, { status: 400 });
    }
    updates.updated_at = db.fn.now();

    const existing = await db('org_settings').first();
    let settings;
    if (existing) {
      [settings] = await db('org_settings').where({ id: existing.id }).update(updates).returning('*');
    } else {
      [settings] = await db('org_settings').insert({ org_name: 'My Organization', ...updates }).returning('*');
    }

    return NextResponse.json({
      message: 'Organization settings updated.',
      org_name: settings.org_name,
      logo_url: settings.logo_url,
      overdue_reminder_threshold_days: settings.overdue_reminder_threshold_days
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    logError('Update settings error', error, { method: request.method, url: request.url });
    return NextResponse.json({ message: 'Internal server error while updating organization settings.' }, { status: 500 });
  }
}
