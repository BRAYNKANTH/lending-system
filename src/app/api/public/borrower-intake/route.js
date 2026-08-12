import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit.js';
import { normalizePhone } from '@/lib/phone.js';
import { isValidSriLankanNIC } from '@/lib/loanSchedule.js';

// Public, unauthenticated borrower-intake submission — the /apply page
// posts here. Deliberately lenient on validation (only name + phone are
// required) since whoever's filling this in — the borrower themselves, a
// family member, or an agent standing with them in the field — may not
// have every detail on hand right away; the review queue is where staff
// catch anything missing or wrong before it becomes a real loan, not this
// endpoint. NIC format IS checked when provided, since that one's cheap to
// validate and easy to mistype.
export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const { limited, retryAfterMs } = checkRateLimit(`borrower-intake:${ip}`, { windowMs: 15 * 60 * 1000, max: 10 });
    if (limited) {
      return NextResponse.json(
        { message: 'Too many submissions from this network. Please wait a while and try again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      );
    }

    const body = await request.json();
    const {
      borrower_name, borrower_phone, borrower_address, date_of_birth, nic_number,
      loan_purpose, dependents_count, monthly_income,
      spouse_name, spouse_nic, spouse_occupation, notes, language
    } = body;

    if (!borrower_name || !borrower_name.trim()) {
      return NextResponse.json({ message: 'Name is required.' }, { status: 400 });
    }
    const cleanPhone = normalizePhone(borrower_phone);
    if (cleanPhone.length < 9) {
      return NextResponse.json({ message: 'A valid phone number is required.' }, { status: 400 });
    }
    let cleanNIC = null;
    if (nic_number && nic_number.trim()) {
      cleanNIC = nic_number.trim().toUpperCase();
      if (!isValidSriLankanNIC(cleanNIC)) {
        return NextResponse.json({ message: 'NIC number format looks wrong — use 9 digits with V/X (e.g. 123456789V) or 12 digits.' }, { status: 400 });
      }
    }
    let dob = null;
    if (date_of_birth) {
      const parsed = new Date(date_of_birth);
      if (isNaN(parsed.getTime()) || parsed > new Date()) {
        return NextResponse.json({ message: 'Date of birth is invalid.' }, { status: 400 });
      }
      dob = date_of_birth;
    }

    const [intake] = await db('borrower_intakes')
      .insert({
        borrower_name: borrower_name.trim(),
        borrower_phone: borrower_phone.trim(),
        borrower_address: borrower_address?.trim() || null,
        date_of_birth: dob,
        nic_number: cleanNIC,
        loan_purpose: loan_purpose?.trim() || null,
        dependents_count: dependents_count !== undefined && dependents_count !== '' ? parseInt(dependents_count, 10) : null,
        monthly_income: monthly_income !== undefined && monthly_income !== '' ? parseFloat(monthly_income) : null,
        spouse_name: spouse_name?.trim() || null,
        spouse_nic: spouse_nic?.trim() || null,
        spouse_occupation: spouse_occupation?.trim() || null,
        notes: notes?.trim() || null,
        submitted_language: language === 'ta' ? 'ta' : 'en'
      })
      .returning(['id']);

    return NextResponse.json({ message: 'Submitted. Thank you — an agent will follow up soon.', id: intake.id }, { status: 201 });
  } catch (error) {
    console.error('Borrower intake submission error:', error);
    return NextResponse.json({ message: 'Something went wrong submitting this form. Please try again.' }, { status: 500 });
  }
}
