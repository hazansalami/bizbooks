import Link from "next/link";
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, Check, FileText, Landmark, Minus, ShieldCheck, Smartphone, UsersRound,
} from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { APP_NAME } from "@/lib/constants";
import { SOLUTIONS, SOLUTION_GROUPS } from "./solutions/data";
import { allArticles, CATEGORIES } from "@/lib/insights";
import { TOOLS } from "@/lib/tools";

const faqs = [
  {
    q: `Who is ${APP_NAME} for?`,
    a: "Registered Nigerian companies where invoicing is part of everyday business: digital and creative agencies, software and IT firms, consultancies, marketing and PR, engineering, logistics and facility management. Freelancers who bill companies use it too.",
  },
  {
    q: "Is it really free to start?",
    a: "Yes. Invoicing, quotes, online payments, expenses, the dashboard and tax tracking are free, with payroll for up to 3 people. Pro adds automation (recurring invoices and expenses without limits, automatic reminders), payroll for your whole team, deposits on quotes and your own branding.",
  },
  {
    q: `Does ${APP_NAME} hold our money?`,
    a: `No. Clients pay into your company's own bank account, or through your own Paystack or Flutterwave account. ${APP_NAME} creates the payment link and confirms the result, but never receives, holds or moves your money.`,
  },
  {
    q: "We use Wave today. Why switch?",
    a: "Wave no longer sends invoices or reminders for businesses outside the US and Canada, and its payments don't support Nigerian gateways. BizBooks sends invoices and reminders, takes payments through Paystack and Flutterwave, and handles Nigerian VAT, WHT, PAYE and pension.",
  },
  {
    q: "Does it run payroll and PAYE?",
    a: "Yes. Add your staff and contractors once and each month BizBooks works out PAYE under the 2026 tax bands, pension, NHF and withholding tax, gives you payslips and a bank upload file, and records the cost in your books. You pay from your own bank.",
  },
  {
    q: "Will it file our taxes?",
    a: "It works out what you owe and when (VAT, PAYE, pension, WHT) and gives your accountant clean reports. Filing and payment still happen through the tax authorities' channels; you mark each one as remitted and the reminders stop.",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pb-24 lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-sun-wash px-3 py-1 text-sm font-semibold text-sun-ink">
              <span className="size-2 rounded-full bg-sun" aria-hidden /> Built for Nigerian companies
            </p>
            <h1 className="mt-5 text-[2.6rem] leading-[1.02] tracking-[-0.035em] sm:text-6xl">
              Your company's finances, clear at a glance.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft">
              Invoicing, expenses, payroll and tax in one place. See your cash flow, profit and what's due every day,
              get paid through your own Paystack or Flutterwave, and never be caught out by a tax deadline.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup" size="lg">Start free</ButtonLink>
              <ButtonLink href="#how-it-works" size="lg" variant="secondary">See what's inside</ButtonLink>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              {["Free to start, no card needed", "PAYE and VAT for 2026", "Your money never passes through us"].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><Check className="size-4 text-brand" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
          <DashboardVisual />
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <p className="text-center text-sm font-semibold text-muted">Made for companies where invoices are how business gets done</p>
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {["Digital & creative agencies", "Software & IT services", "Consultancies", "Marketing & PR", "Engineering firms", "Logistics", "Facility management", "Professional services"].map((t) => (
              <li key={t} className="rounded-full border border-line px-4 py-1.5 text-sm font-medium text-ink-soft">{t}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Three pillars, grouped like the product */}
      <section id="how-it-works" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="max-w-3xl text-3xl sm:text-4xl">One place for the money side of the business.</h2>
          <p className="mt-3 max-w-2xl text-lg text-ink-soft">Start with a clear picture, then act on it: bill clients, pay your team, keep the tax office happy.</p>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {SOLUTION_GROUPS.map((g, i) => {
              const Icon = [BarChart3, FileText, UsersRound][i];
              return (
                <div key={g} className="flex flex-col rounded-3xl border border-line bg-paper p-6">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-wash text-brand"><Icon className="size-5" aria-hidden /></span>
                  <h3 className="mt-4 text-xl">{g}</h3>
                  <ul className="mt-4 flex-1 space-y-3">
                    {SOLUTIONS.filter((s) => s.group === g).map((s) => (
                      <li key={s.slug}>
                        <Link href={`/solutions/${s.slug}`} className="group block">
                          <span className="flex items-center gap-1 font-semibold group-hover:text-brand">{s.name}<ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden /></span>
                          <span className="block text-sm text-ink-soft">{s.menu}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tax protection */}
      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <Landmark className="size-9 text-sun" aria-hidden />
            <h2 className="mt-4 text-3xl sm:text-4xl">See every tax deadline coming, with the amount.</h2>
            <p className="mt-4 text-lg text-white/80">
              BizBooks works out the VAT on your invoices, the PAYE and pension on your payroll and the WHT on contractor payments,
              then puts each one on a calendar with how much to keep aside. Late remittance attracts penalties; missing it is now
              much harder.
            </p>
            <ButtonLink href="/solutions/taxes" variant="light" className="mt-6">How tax tracking works</ButtonLink>
          </div>
          <ul className="space-y-2.5">
            {[
              ["PAYE for September", "Due 10 Oct · State IRS", "₦842,300", "Due this week"],
              ["Pension for September", "Due 2 Oct · Staff PFAs", "₦1,120,000", "Remitted"],
              ["VAT for September", "Due 21 Oct · NRS", "₦612,750", "Coming up"],
              ["Contractor WHT for September", "Due 21 Oct · NRS", "₦95,000", "Coming up"],
            ].map(([t, sub, amt, st]) => (
              <li key={t} className="flex items-center gap-3 rounded-2xl bg-white/[0.07] p-4">
                <div className="min-w-0 flex-1"><p className="font-semibold">{t}</p><p className="text-sm text-white/60">{sub}</p></div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st === "Remitted" ? "bg-brand text-white" : st === "Due this week" ? "bg-sun text-ink" : "bg-white/15 text-white"}`}>{st}</span>
                <span className="num w-24 text-right font-bold">{amt}</span>
              </li>
            ))}
            <li className="px-1 text-xs text-white/50">Example figures for illustration.</li>
          </ul>
        </div>
      </section>

      {/* Money never held */}
      <section>
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <ShieldCheck className="size-10 text-brand" aria-hidden />
            <h2 className="mt-4 text-3xl sm:text-4xl">Your money goes straight to you.</h2>
            <p className="mt-4 text-lg text-ink-soft">
              {APP_NAME} is not a wallet and not a middleman. Clients pay into <strong>your</strong> bank account, or
              through <strong>your</strong> Paystack or Flutterwave account. Salaries go from <strong>your</strong> bank.
              We keep the records and do the maths.
            </p>
            <p className="mt-4 text-ink-soft">Gateway keys are encrypted and can be disconnected at any time.</p>
          </div>
          <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8">
            <ol className="space-y-5">
              {[
                ["Your client", "Opens the invoice and taps “Pay ₦3,354,000”"],
                ["Your Paystack / Flutterwave", "Takes the payment by card, transfer or USSD"],
                ["Your bank account", "Receives it on your usual payout schedule"],
                [APP_NAME, "Marks the invoice paid and updates cash flow, profit and VAT"],
              ].map(([who, what], i) => (
                <li key={who} className="flex gap-4">
                  <span className={`num grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${i === 3 ? "bg-sun text-ink" : "bg-brand text-white"}`}>{i + 1}</span>
                  <div><p className="font-semibold">{who}</p><p className="text-ink-soft">{what}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Moving from Wave */}
      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl sm:text-4xl">Moving from Wave?</h2>
          <p className="mt-3 text-lg text-ink-soft">
            Wave has stopped sending invoices and reminders for businesses outside the US and Canada, and its payments
            don't work with Nigerian gateways. {APP_NAME} keeps what made Wave simple and adds what Nigerian companies need.
          </p>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="bg-canvas">
                <tr>
                  <th scope="col" className="p-4 font-semibold"><span className="sr-only">Feature</span></th>
                  <th scope="col" className="p-4 font-bold text-brand-deep">{APP_NAME}</th>
                  <th scope="col" className="p-4 font-semibold">Wave (in Nigeria)</th>
                  <th scope="col" className="p-4 font-semibold">Spreadsheets</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Send invoices and automatic reminders", true, false, false],
                  ["Online payments with Paystack or Flutterwave", true, false, false],
                  ["Dashboard: cash flow, profit, who owes what", true, true, false],
                  ["Payroll with PAYE and pension (2026 rules)", true, false, false],
                  ["VAT, WHT, PAYE and pension deadlines", true, false, false],
                  ["Quotes with deposits", true, true, false],
                  ["Free to start", true, true, true],
                ].map(([label, a, b, c]) => (
                  <tr key={label as string} className="border-t border-line">
                    <th scope="row" className="p-4 font-medium">{label as string}</th>
                    {[a, b, c].map((v, i) => (
                      <td key={i} className="p-4">{v ? <Check className="size-5 text-brand" aria-label="Yes" /> : <Minus className="size-5 text-muted/60" aria-label="No" />}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">Based on Wave's own notice to users outside the US and Canada, September 2026.</p>
        </div>
      </section>

      {/* Mobile */}
      <section>
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sun-wash text-sun-ink"><Smartphone className="size-7" aria-hidden /></span>
          <div className="flex-1">
            <h2 className="text-2xl">On your desk and in your pocket.</h2>
            <p className="mt-1 text-ink-soft">Install {APP_NAME} from your browser. Send an invoice, snap a receipt or approve payroll from your phone. No app store download.</p>
          </div>
        </div>
      </section>

      {/* Free calculators (lead magnets) */}
      <section className="border-t border-line bg-brand-wash">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl">Free calculators, updated for 2026</h2>
              <p className="mt-2 text-ink-soft">PAYE, company tax, VAT and what a hire really costs. No sign-up.</p>
            </div>
            <Link href="/tools" className="font-semibold text-brand-deep hover:underline">All calculators →</Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t) => (
              <Link key={t.slug} href={t.href} className="group rounded-2xl bg-paper p-5 hover:shadow-md">
                <p className="font-semibold group-hover:text-brand-deep">{t.title}</p>
                <p className="mt-1 text-sm text-ink-soft">{t.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Guides */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl">Free guides for Nigerian companies</h2>
              <p className="mt-2 text-ink-soft">The 2026 tax rules, payroll and getting paid, explained plainly.</p>
            </div>
            <Link href="/insights" className="font-semibold text-brand hover:underline">All guides →</Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {allArticles().filter((a) => a.featured).slice(0, 3).map((a) => (
              <Link key={a.slug} href={`/insights/${a.slug}`} className="group rounded-2xl border border-line bg-paper p-5 hover:border-ink">
                <p className="text-xs font-bold uppercase tracking-wider text-brand">{CATEGORIES[a.category].name}</p>
                <p className="mt-2 font-semibold leading-snug group-hover:text-brand-deep">{a.title}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-line bg-paper">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl sm:text-4xl">Questions</h2>
          <div className="mt-8 divide-y divide-line rounded-2xl border border-line">
            {faqs.map((f) => (
              <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                  {f.q}
                  <span aria-hidden className="text-2xl font-normal text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "SoftwareApplication",
                  name: APP_NAME,
                  applicationCategory: "BusinessApplication",
                  operatingSystem: "Web, Android, iOS",
                  offers: { "@type": "Offer", price: "0", priceCurrency: "NGN" },
                  description: "Accounting, invoicing, payroll and tax tracking for Nigerian companies, with payments through the company's own Paystack or Flutterwave account.",
                },
                { "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
              ],
            }),
          }}
        />
      </section>

      {/* Final CTA */}
      <section className="bg-brand text-white">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-3xl sm:text-5xl">See your company's finances clearly, starting today.</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">Free to start. The setup guide takes a few minutes, and you can skip anything you're not ready for.</p>
          <ButtonLink href="/signup" size="lg" variant="light" className="mt-8">Create my free account</ButtonLink>
          <p className="mt-4 text-sm text-white/75">Already have an account? <Link href="/login" className="font-semibold underline">Log in</Link></p>
        </div>
      </section>
    </>
  );
}

/** A simplified picture of the Overview dashboard. Example data. */
function DashboardVisual() {
  const bars = [[38, 22], [52, 30], [44, 41], [70, 35], [58, 46], [84, 40]];
  return (
    <div className="relative mx-auto w-full max-w-xl" aria-hidden>
      <div className="absolute -right-8 -top-8 size-48 rounded-full bg-sun/25 blur-3xl" />
      <div className="relative overflow-hidden rounded-3xl border border-line bg-paper shadow-2xl shadow-ink/10">
        <div className="flex items-center gap-1.5 border-b border-line bg-canvas px-4 py-3">
          <span className="size-2.5 rounded-full bg-line-strong" /><span className="size-2.5 rounded-full bg-line-strong" /><span className="size-2.5 rounded-full bg-line-strong" />
          <span className="ml-3 text-xs font-semibold text-muted">Overview · Northwind Creative Ltd</span>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-4 gap-2 text-[10px] font-semibold sm:text-xs">
            {[["Create quote", "bg-[#e3f2ea]"], ["Create invoice", "bg-[#e7eef8]"], ["Add bill", "bg-[#fdf1dc]"], ["Run payroll", "bg-[#efeaf7]"]].map(([l, c]) => (
              <span key={l} className={`rounded-xl px-2 py-2.5 text-center ${c}`}>{l}</span>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1.1fr_1fr]">
            <div className="rounded-2xl border border-line p-3">
              <p className="text-xs font-semibold">Cash flow</p>
              <div className="mt-3 flex h-24 items-end gap-2">
                {bars.map(([a, b], i) => (
                  <div key={i} className="flex h-full flex-1 items-end justify-center gap-0.5">
                    <span className="w-2.5 rounded-t-[3px] bg-[#0E7A55]" style={{ height: `${a}%` }} />
                    <span className="w-2.5 rounded-t-[3px] bg-[#C9731F]" style={{ height: `${b}%` }} />
                  </div>
                ))}
              </div>
              <p className="mt-2 flex justify-between text-[10px] text-muted"><span>Apr</span><span>Sep</span></p>
            </div>
            <div className="rounded-2xl border border-line p-3">
              <p className="text-xs font-semibold">Next 30 days</p>
              <ul className="mt-2 space-y-2 text-[11px]">
                {[["in", "Harbour Logistics", "+₦3.35m"], ["out", "Payroll · 25 Oct", "−₦4.2m"], ["out", "VAT · 21 Oct", "−₦613k"], ["in", "Lagoon Retail", "+₦1.9m"]].map(([d, l, a]) => (
                  <li key={l} className="flex items-center gap-2">
                    <span className={`grid size-5 place-items-center rounded-full ${d === "in" ? "bg-brand-wash text-brand" : "bg-sun-wash text-sun-ink"}`}>{d === "in" ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}</span>
                    <span className="flex-1 truncate">{l}</span><span className="num font-bold">{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            {[["Clients owe you", "₦8.4m"], ["Profit this year", "₦30.4m"], ["Keep aside for tax", "₦1.5m"]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-canvas p-2.5"><p className="text-muted">{l}</p><p className="num text-sm font-bold">{v}</p></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
