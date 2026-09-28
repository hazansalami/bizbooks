# Calculator lead nurture sequence

The full copy lives in `src/lib/nurture.ts` (one source of truth). This page is the overview for marketing.

```
Sequence:  Calculator lead nurture
Trigger:   Visitor clicks "Email me this breakdown" on any /tools calculator (email 1 = the results email)
Goal:      Start BizBooks free (primary) or book an Advisors consultation (secondary)
Length:    6 emails over ~16 days (results + 5 follow-ups)
Timing:    Day 0, 2, 5, 8, 12, 16. Weekend sends move to Monday. Sent by the daily job (06:00 UTC).
Tracks:    PAYROLL (PAYE, net-to-gross, employer cost) · TAX (company tax, VAT) · INVOICING (VAT & WHT)
Exits:     Signs up for BizBooks (checked before every send) · unsubscribes (one click + RFC 8058 header) · finishes
Rules:     One sequence per address. Later calculator uses and existing customers aren't enrolled.
           Unsubscribed addresses are never re-enrolled.
```

| # | Day | Job | Subject | CTA → destination |
|---|---|---|---|---|
| 1 | 0 | Deliver the results + bonus guide | Your [calculator] results | Bonus guide for that calculator |
| 2 | 2 | Expand on the topic (track-specific) | PAYROLL: "3 PAYE mistakes employers are making in 2026" · TAX: "The 3 tax deadlines that catch companies out" · INVOICING: "Why your client paid less than your invoice" | PAYE guide · Tax calendar · WHT guide |
| 3 | 5 | Problem deep-dive (track-specific) | PAYROLL: "What a new hire really costs" · TAX: "Is your company still 'small' for tax?" · INVOICING: "The reminder schedule that gets invoices paid" | Employer cost calculator · Small company guide · Collections playbook |
| 4 | 8 | Framework (shared) | A 2-hour month-end routine for your books | Month-end checklist |
| 5 | 12 | Differentiation (shared) | We built BizBooks for the gap Wave left in Nigeria | Start free (/signup) |
| 6 | 16 | Direct offer + objection (shared) | Rather hand this to someone else? | Book a free consultation (/advisors), or start free |

All links carry `utm_source=nurture&utm_medium=email&utm_campaign=calc_<step>`.

## Measure

| Metric | Where | Healthy range to aim for |
|---|---|---|
| Calculator → email capture rate | `Lead` rows ÷ calculator page views | 5–15% |
| Open rate per step | Resend dashboard | 35–50% |
| Click rate per step | UTM `calc_<n>` in analytics | 2–5% |
| Unsubscribe rate per step | `Lead.unsubscribedAt` | under 1% per email |
| Lead → sign-up | `Lead.convertedAt` ÷ enrolled leads | 3–8% |
| Lead → advisory consultation | `AdvisorRequest` with matching email | track from day one |

**Test first:** email 5's subject (Wave angle vs. benefit-led: "Invoices, payroll and tax deadlines in one place"),
and email 2 sent on day 1 vs. day 2.

## Before going live

- Set `RESEND_API_KEY` and `EMAIL_FROM` on a verified domain (with SPF, DKIM and DMARC), or emails only go to the server log.
- Add a physical business address to the email footer once `src/lib/legal.ts` is filled in.
