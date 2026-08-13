import { NextResponse } from 'next/server';
import db from '@/lib/db.js';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit.js';
import { normalizePhone } from '@/lib/phone.js';
import { isValidSriLankanNIC } from '@/lib/loanSchedule.js';
import { validateImageDataUrlArray } from '@/lib/services/image.js';

const MAX_GUARANTORS = 2;

// Validates one optional guarantor block from the public form — the
// section itself is optional (a submission can have 0, 1, or 2), but once
// a guarantor has a name it's "in use" and its NIC photo becomes required,
// same as the borrower's own. Everything else (NIC number, address, phone,
// income/expense) stays lenient and is accepted as-is if present. Photo
// proof is not a concept for guarantors at all (NIC photo alone identifies
// them) — not even accepted as an optional input, so photo_proof_urls is
// always null here regardless of what a caller sends.
function cleanOptionalGuarantor(g) {
  if (!g || typeof g !== 'object' || !g.full_name || !g.full_name.trim()) return null;

  const cleaned = {
    full_name: g.full_name.trim(),
    nic_number: null,
    address: g.address?.trim() || null,
    phone: g.phone?.trim() || null,
    gender: g.gender || null,
    nic_photo_urls: null,
    photo_proof_urls: null,
    protected_under_debt_act: !!g.protected_under_debt_act,
    has_pending_court_cases: !!g.has_pending_court_cases,
    monthly_income_business: g.monthly_income_business !== undefined && g.monthly_income_business !== '' ? parseFloat(g.monthly_income_business) : null,
    monthly_income_agriculture: g.monthly_income_agriculture !== undefined && g.monthly_income_agriculture !== '' ? parseFloat(g.monthly_income_agriculture) : null,
    monthly_income_other: g.monthly_income_other !== undefined && g.monthly_income_other !== '' ? parseFloat(g.monthly_income_other) : null,
    monthly_expense_food: g.monthly_expense_food !== undefined && g.monthly_expense_food !== '' ? parseFloat(g.monthly_expense_food) : null,
    monthly_expense_rent: g.monthly_expense_rent !== undefined && g.monthly_expense_rent !== '' ? parseFloat(g.monthly_expense_rent) : null,
    monthly_expense_other: g.monthly_expense_other !== undefined && g.monthly_expense_other !== '' ? parseFloat(g.monthly_expense_other) : null
  };

  if (g.nic_number && g.nic_number.trim()) {
    const nic = g.nic_number.trim().toUpperCase();
    if (!isValidSriLankanNIC(nic)) {
      throw new Error(`Guarantor '${g.full_name}'s NIC number format looks wrong — use 9 digits with V/X (e.g. 123456789V) or 12 digits.`);
    }
    cleaned.nic_number = nic;
  }
  if (!Array.isArray(g.nic_photos) || g.nic_photos.length === 0) {
    throw new Error(`A NIC photo (at least 1) is required for guarantor '${g.full_name}'.`);
  }
  const urls = validateImageDataUrlArray(g.nic_photos);
  if (!urls) throw new Error(`One of guarantor '${g.full_name}'s NIC photos couldn't be processed. Upload 1-4 valid JPEG/PNG/WebP images, each under 4MB.`);
  cleaned.nic_photo_urls = urls;

  return cleaned;
}

// Public, unauthenticated borrower-intake submission — the /apply page
// posts here. Lenient on most fields (address, DOB, spouse details, notes,
// guarantors — the review queue is where staff catch anything missing or
// wrong before it becomes a real loan) but NOT on the borrower's own KYC
// photos: NIC Photo and Photo Proof are must-have, same as the internal
// Give Loan wizard requires, since a loan can't actually disburse without
// them anyway — better to ask for them up front than have every submission
// bounce back from the review queue for the same missing piece.
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
      nic_photos, photo_proofs,
      loan_purpose, dependents_count, monthly_income,
      spouse_name, spouse_nic, spouse_occupation, notes, language, guarantors
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

    if (!Array.isArray(nic_photos) || nic_photos.length === 0) {
      return NextResponse.json({ message: 'At least 1 NIC photo is required.' }, { status: 400 });
    }
    const nicPhotoUrls = validateImageDataUrlArray(nic_photos);
    if (!nicPhotoUrls) {
      return NextResponse.json({ message: 'One of the NIC photos could not be processed. Upload 1-4 valid JPEG/PNG/WebP images, each under 4MB.' }, { status: 400 });
    }
    if (!Array.isArray(photo_proofs) || photo_proofs.length === 0) {
      return NextResponse.json({ message: 'At least 1 photo proof is required.' }, { status: 400 });
    }
    const photoProofUrls = validateImageDataUrlArray(photo_proofs);
    if (!photoProofUrls) {
      return NextResponse.json({ message: 'One of the photo proof images could not be processed. Upload 1-4 valid JPEG/PNG/WebP images, each under 4MB.' }, { status: 400 });
    }

    let cleanGuarantors = [];
    if (Array.isArray(guarantors)) {
      if (guarantors.length > MAX_GUARANTORS) {
        return NextResponse.json({ message: `At most ${MAX_GUARANTORS} guarantors can be submitted.` }, { status: 400 });
      }
      try {
        cleanGuarantors = guarantors.map(cleanOptionalGuarantor).filter(Boolean);
      } catch (err) {
        return NextResponse.json({ message: err.message }, { status: 400 });
      }
    }

    const [intake] = await db('borrower_intakes')
      .insert({
        borrower_name: borrower_name.trim(),
        borrower_phone: borrower_phone.trim(),
        borrower_address: borrower_address?.trim() || null,
        date_of_birth: dob,
        nic_number: cleanNIC,
        nic_photo_urls: JSON.stringify(nicPhotoUrls),
        photo_proof_urls: JSON.stringify(photoProofUrls),
        loan_purpose: loan_purpose?.trim() || null,
        dependents_count: dependents_count !== undefined && dependents_count !== '' ? parseInt(dependents_count, 10) : null,
        monthly_income: monthly_income !== undefined && monthly_income !== '' ? parseFloat(monthly_income) : null,
        spouse_name: spouse_name?.trim() || null,
        spouse_nic: spouse_nic?.trim() || null,
        spouse_occupation: spouse_occupation?.trim() || null,
        notes: notes?.trim() || null,
        submitted_language: language === 'ta' ? 'ta' : 'en',
        guarantors: JSON.stringify(cleanGuarantors)
      })
      .returning(['id']);

    return NextResponse.json({ message: 'Submitted. Thank you — an agent will follow up soon.', id: intake.id }, { status: 201 });
  } catch (error) {
    console.error('Borrower intake submission error:', error);
    return NextResponse.json({ message: 'Something went wrong submitting this form. Please try again.' }, { status: 500 });
  }
}
