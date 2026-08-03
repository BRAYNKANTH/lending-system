# Cash Lending & Agent Collection Management System

A complete fintech cash lending, interest accrual, and physical agent collection tracking web application, built as a single **Next.js** app (App Router) so it deploys to **Vercel** as one project. Installable as a **PWA** on phones. The system operates on a **Double-Entry General Ledger** structure ensuring traceability, audit readiness, and consistent balance records.

> The previous separate Express backend + Vite frontend is preserved under `legacy-backend/` and `legacy-frontend/` for reference and is no longer used.

---

## 🛠️ Technology Stack
* **Framework**: Next.js 14 (App Router) — React pages and API routes in one project.
* **Database**: PostgreSQL only (tested against Supabase; Neon/Vercel Postgres also work) via Knex.js.
* **Auth**: JSON Web Tokens (JWT) with Role-Based Access Control (RBAC).
* **Scheduled jobs**: Vercel Cron (replaces the old `setInterval` background loop, which can't run on serverless).
* **PWA**: `@ducanh2912/next-pwa` — installable on phones, works offline for cached assets.
* **Alerts**: Decoupled mock SMS/WhatsApp notification dispatcher (console + local log; swap in a real provider in `src/lib/services/notification.js`).
* **Images** (NIC photos, payment proof): stored as base64 directly in the database — Vercel's filesystem is read-only/ephemeral, so nothing is written to disk.

---

## 🚀 Local Development

### 1. Get a Postgres connection string
Any hosted Postgres works. For Supabase specifically:
1. Create a free project at [supabase.com](https://supabase.com).
2. Project Settings → Database → **Connection pooling** → copy the **Transaction pooler** URI (port 6543). Supabase's *direct* connection (port 5432) is IPv6-only on new projects and won't work from most networks/serverless environments — always use the pooler string.

### 2. Configure environment variables
```bash
cp .env.local.example .env.local
```
Fill in:
- `DATABASE_URL` — the pooler connection string from step 1
- `JWT_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `CRON_SECRET` — generate the same way (used to authenticate Vercel Cron's request to the accrual endpoint)

### 3. Install dependencies and run the migration
```bash
npm install
npm run db:migrate
```
This creates all tables and, on a fresh database, seeds demo accounts (see credentials below). It's safe to re-run any time — it only adds what's missing.

### 4. Start the dev server
```bash
npm run dev
```
Open `http://localhost:3000`.

---

## ☁️ Deploying to Vercel

1. Push this repo to GitHub and import it into Vercel (or run `vercel` from the CLI).
2. In Vercel Project Settings → Environment Variables, set `DATABASE_URL`, `JWT_SECRET`, and `CRON_SECRET` (same values as `.env.local`, or fresh ones for production).
3. Before or after the first deploy, run the migration once against your production database:
   ```bash
   npm run db:migrate
   ```
   (Run this from your machine with `.env.local` pointed at the production `DATABASE_URL`, or via `vercel env pull` first.)
4. Deploy. `vercel.json` already defines the cron job that hits `/api/cron/accrue-interest` daily.

**Cron interval note**: Vercel's Hobby (free) plan only allows cron jobs to run once per day at minimum. The schedule in `vercel.json` (`0 0 * * *`) reflects that. If you're on a Pro plan, you can tighten this (e.g. hourly: `0 * * * *`) to match real repayment cadences more closely.

**Rate limiting note**: Login attempts are rate-limited in-memory per warm serverless instance — a reasonable extra layer, but not a hard distributed guarantee under real attack traffic (see comments in `src/lib/rateLimit.js`). The per-account lockout (5 failed logins → 15 min lock, stored in Postgres) is the strong guarantee and works correctly regardless of instance.

---

## 📱 Installing as a PWA
Once deployed (PWA is disabled in local dev), visiting the site on a phone will offer an "Add to Home Screen" / "Install app" prompt (Android Chrome shows this automatically; iOS Safari requires Share → Add to Home Screen). The app icon, name, and theme color are configured in `public/manifest.webmanifest`.

---

## 🔐 Credentials Checklist for Demo Testing
All seeded accounts use the password: **`password123`**

| Role | Username / Email | Key Features to Test |
| :--- | :--- | :--- |
| **Lender Admin** | `admin@lend.com` | Disburse new loans (with optional installment schedule + guarantor), view dashboard metrics, trigger manual interest accruals, edit/default/penalize loans, manage users, verify agent cash remittances, view the ledger/trial-balance report. |
| **Collection Agent** | `agent@lend.com` | Collect payments, view assigned route, submit cash remittances to the office, see cash-in-hand. |
| **Borrower** | `borrower@lend.com` | View outstanding balances, installment passbook, interest accrual history, payments made. |
| **Borrower 2** | `borrower2@lend.com` | Secondary borrower with an active weekly loan. |

---

## 🧠 Core Business Logic & Accounting Architecture

### Double-Entry General Ledger Posting
Every money movement writes two matching `ledger_entries` rows inside a locked database transaction (`SELECT ... FOR UPDATE`), with an `idempotency_key` on payments to block double submissions:
- **Loan disbursement**: Debit `loan_receivable` / Credit `cash_office`
- **Payment collection**: Debit `cash_agent` / Credit `loan_receivable`
- **Interest accrual**: Debit `loan_receivable` / Credit `interest_revenue`
- **Penalty/late fee**: Debit `loan_receivable` / Credit `penalty_revenue`
- **Agent cash remittance**: Debit `cash_office` / Credit `cash_agent`

Check `/api/reports/ledger` (admin) for a trial balance across all accounts — `totals.balanced` should be `true` once all entries are posted correctly.

### Interest Accrual Job Engine
Vercel Cron hits `/api/cron/accrue-interest` on the schedule in `vercel.json`. For every active loan that has reached its `next_accrual_date`:
1. Interest is computed: `Interest = principal_amount * (interest_rate / 100)`.
2. The loan's `current_balance` increases by that amount.
3. A matching ledger entry pair posts (see above).
4. `next_accrual_date` advances by the loan's frequency (1, 7, or 30 days).

### Installment Schedules (optional, per loan)
A loan can optionally specify a number of installments at creation. This generates a fixed repayment passbook (equal installments covering principal + flat-rate interest) — purely a repayment-tracking overlay; it doesn't change how or when interest is recognized in the ledger, which keeps running on the mechanism above. Payments are allocated to the oldest unpaid installment first, splitting across installments as needed.

### Guarantors (optional, per loan)
Loans can optionally record a guarantor's personal/financial details (mirrors the physical guarantor form): identity, contact, legal declarations, and income/expense breakdown.
