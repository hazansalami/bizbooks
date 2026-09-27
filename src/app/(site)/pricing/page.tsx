import type { Metadata } from "next";
import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { APP_NAME, PLANS } from "@/lib/constants";
import { naira } from "@/lib/money";

export const metadata: Metadata = {
  title: "Pricing",
  description: `${APP_NAME} is free to start for invoicing, payments, expenses, payroll for up to 3 people and tax tracking. Pro adds automation, full payroll and your own branding.`,
  alternates: { canonical: "/pricing" },
};

export default function Pricing() {
  const yearlySaving = PLANS.PRO.monthly * 12 - PLANS.PRO.yearly;
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl">Start free. Upgrade when it pays for itself.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-soft">
          If one automatic reminder gets one late client to pay, Pro has covered its cost for the year.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <div className="flex flex-col rounded-3xl border border-line bg-paper p-7">
          <h2 className="text-2xl">{PLANS.FREE.name}</h2>
          <p className="mt-1 text-muted">{PLANS.FREE.blurb}</p>
          <p className="mt-6"><span className="num text-5xl font-bold">₦0</span> <span className="text-muted">forever</span></p>
          <ul className="mt-6 flex-1 space-y-3">
            {PLANS.FREE.features.map((f) => (
              <li key={f} className="flex gap-2.5"><Check className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />{f}</li>
            ))}
          </ul>
          <ButtonLink href="/signup" variant="secondary" size="lg" className="mt-8">Create my free account</ButtonLink>
        </div>

        <div className="relative flex flex-col rounded-3xl border-2 border-brand bg-paper p-7 shadow-xl shadow-brand/10">
          <span className="absolute -top-3.5 left-7 rounded-full bg-sun px-3 py-1 text-xs font-bold text-ink">For growing teams</span>
          <h2 className="text-2xl">{PLANS.PRO.name}</h2>
          <p className="mt-1 text-muted">{PLANS.PRO.blurb}</p>
          <p className="mt-6"><span className="num text-5xl font-bold">{naira(PLANS.PRO.monthly)}</span> <span className="text-muted">/ month</span></p>
          <p className="mt-1 text-sm text-brand-deep">or {naira(PLANS.PRO.yearly)} a year, which saves you {naira(yearlySaving)}</p>
          <ul className="mt-6 flex-1 space-y-3">
            {PLANS.PRO.features.map((f) => (
              <li key={f} className="flex gap-2.5"><Check className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />{f}</li>
            ))}
          </ul>
          <ButtonLink href="/signup?plan=pro" size="lg" className="mt-8">Start free, then upgrade</ButtonLink>
          <p className="mt-3 text-center text-sm text-muted">No automatic charges. You renew when you choose to.</p>
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-3xl rounded-2xl bg-brand-wash p-6 text-brand-deep">
        <h2 className="text-lg">What about payment fees?</h2>
        <p className="mt-1">
          {APP_NAME} adds nothing on top. Online payments go through your company's own Paystack or Flutterwave account at
          their standard rates and settle into your bank as usual. Bank transfers straight to your account cost nothing extra.
          Payroll is paid from your own bank, so there are no per-payslip charges either.
        </p>
      </div>
    </section>
  );
}
