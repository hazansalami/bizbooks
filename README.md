# BizBooks

Accounting, invoicing, payroll and tax tracking for registered Nigerian companies (agencies, consultancies,
IT and B2B service firms), modelled on Wave's structure and filling the gaps Wave leaves in Nigeria.

**Overview dashboard** (Wave-style): action tiles, overdue invoices and bills, cash flow (inflow/outflow/net),
next 30 days (invoices due, bills, payroll, tax deadlines), profit & loss, expense breakdown, net income by year,
and payable/owing aging.

- **Get paid:** invoices (RC/TIN, client PO, 7.5% VAT, 5/10% WHT, amount in words), quotes clients accept online
  with deposits credited on the final invoice, recurring invoices, reminders, payments through the company's
  **own** Paystack/Flutterwave, "I've sent the transfer" claims
- **Spend:** expenses with receipt photos, bills (unpaid supplier invoices with due dates), recurring expenses
  (as paid entries or as bills to approve)
- **Pay your team:** payroll for staff (PAYE under the 2026 bands, 8%/10% pension, NHF, rent relief) and contractors
  (WHT), payslips, bank bulk-transfer CSV; marking a run paid writes the salary expenses
- **Stay tax-ready:** reports hub (P&L accrual/cash, Cash Flow, VAT, Income by Client, Aged Receivables, Client
  Deposits, Purchases by Supplier, Aged Payables, Payroll Summary, All Transactions) and a tax calendar for VAT,
  PAYE, pension and WHT with "mark as remitted"
- 5-step onboarding wizard for companies (entity type, CAC number, team size, professional services, TIN)
- Installable PWA

## Why BizBooks never holds money

Customers pay the business directly: into its bank account, or through its own Paystack/Flutterwave
account using the secret key the owner connects. BizBooks only creates the checkout link, verifies the
result with the gateway, and updates the books. No funds pass through the platform, which keeps it
outside payment-licensing territory. **Get a Nigerian fintech lawyer to confirm this for your exact
setup before launch.** The only money BizBooks collects is its own Pro subscription, through the
platform's own Paystack account.

## Stack

Same as the ECDI portal: Next.js 16 (App Router, server actions) · React 19 · Prisma 7 + PostgreSQL
(Supabase in production, `prisma dev` locally) · Tailwind CSS 4 · jose sessions · Resend for email ·
Vercel (hosting + daily cron).

## Run it locally

```bash
npm install
npx prisma dev --name bizbooks --detach   # prints a postgres:// URL
cp .env.example .env                       # paste the URL, generate the secrets as described inside
npx prisma migrate deploy
npm run db:seed                            # demo agency: demo@bizbooks.test, password = SEED_DEMO_PASSWORD
npm run dev
```

Without `RESEND_API_KEY`, emails are printed to the terminal instead of sent.

**Schema changes locally:** `prisma dev` serves a single `template1` database, which breaks `migrate dev`'s
shadow database. Generate migrations without one:

```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/<timestamp>_<name>/migration.sql
npx prisma migrate deploy
```

Against Supabase, plain `npx prisma migrate dev` works.

## Deploy (Vercel + Supabase)

1. Create a Supabase project. Put the **transaction pooler** URL (port 6543) in `DATABASE_URL` and the **session/direct** URL (5432) in `DIRECT_URL`.
2. Import the repo into Vercel and set every variable from `.env.example`. `ENCRYPTION_KEY` must never change after launch.
3. Run `npx prisma migrate deploy` against production once.
4. `vercel.json` schedules `/api/cron/daily` at 06:00 UTC (07:00 Lagos). Set `CRON_SECRET` in Vercel.
5. Verify a sending domain in Resend and set `EMAIL_FROM`.
6. For Pro billing, add `PLATFORM_PAYSTACK_SECRET_KEY` and set the Paystack webhook to `https://<domain>/api/webhooks/platform`.

## How payments flow

| Step | Code |
|---|---|
| Email/WhatsApp link `/pay/<token>` goes straight to the gateway checkout | `src/app/pay/[token]/route.ts` |
| Checkout started with the business's decrypted key | `src/lib/checkout.ts`, `src/lib/gateways.ts` |
| Customer returns: payment verified **with the gateway**, then recorded | `src/app/api/pay/callback/route.ts` |
| Webhook backup (signature checked with that business's key, then re-verified) | `src/app/api/webhooks/{paystack,flutterwave}/[businessId]` |
| Redirect and webhook both arriving is safe: unique gateway reference | `Payment.reference @unique` |

## Things to confirm before launch

- **Prices** in `src/lib/constants.ts` (`PLANS`) are placeholders (Free / Pro ₦12,500 a month).
- **Payroll simplifications**: monthly gross is treated as pensionable pay and NHF as 2.5% of gross; these are shown to users. Have a payroll accountant check a real month before launch.
- **Balance Sheet / Trial Balance** need a double-entry ledger and bank feeds (e.g. Mono); they're listed as "coming soon", not faked.
- **Tax figures** in `TAX` (same file) were checked against published summaries of the Nigeria Tax Act 2025 in Sept 2026. Sources disagree on some thresholds, so have a tax adviser confirm them. The app labels all tax figures as estimates.
- **Name**: "BizBooks" is a working name; check trademark and domain availability.
- **Timezone**: the server runs in UTC on Vercel, so "today" boundaries for the daily job are one hour off Lagos time.
