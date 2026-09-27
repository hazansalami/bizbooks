import type { Metadata } from "next";
import Link from "next/link";
import { Check, ClipboardCheck, MessagesSquare, Repeat } from "lucide-react";
import { ADVISOR_SERVICES } from "@/lib/advisors";
import { APP_NAME } from "@/lib/constants";
import { naira } from "@/lib/money";
import { AdvisorForm } from "@/components/advisor-form";

const faqs = [
  { q: `Who are ${APP_NAME} Advisors?`, a: "A team of accountants and tax specialists who keep your books, handle your filings and run your payroll, working from your BizBooks records so everything stays in one place." },
  { q: "Do I need to use BizBooks to work with an advisor?", a: "It helps, because your advisor sees invoices, expenses and payroll as they happen. If you're on other tools today, we'll plan the move with you during the consultation." },
  { q: "Will you file and pay my taxes?", a: "We prepare and file VAT, WHT, PAYE and annual returns, and give you the exact amounts and deadlines. Payments come from your own company account, so your money always stays under your control." },
  { q: "Can you fix books that are months or years behind?", a: "Yes. Catch-up and clean-up work is quoted as a fixed fee after a free review of your records and bank statements." },
  { q: "How does pricing work?", a: "Monthly plans based on your transaction volume, team size and the services you choose. The figures on this page are starting prices. You'll get a fixed quote after the consultation." },
];

export const metadata: Metadata = {
  title: "Advisors: outsourced bookkeeping, tax and payroll for Nigerian companies",
  description: "Hand your bookkeeping, VAT, WHT, PAYE, payroll and annual returns to the BizBooks advisory team. Monthly plans, fixed quotes and a free consultation.",
  alternates: { canonical: "/advisors" },
};

export default function Advisors() {
  return (
    <>
      <section className="border-b border-line bg-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-brand">{APP_NAME} Advisors</p>
            <h1 className="mt-3 text-4xl leading-[1.05] tracking-[-0.03em] sm:text-5xl">Hand your books, taxes and payroll to people who do this every day.</h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft">
              Our accountants and tax specialists keep your records clean, file VAT, WHT and PAYE on time, run payroll and
              send you a clear report every month, so you can spend your time on clients.
            </p>
            <ul className="mt-6 space-y-2 text-ink-soft">
              {["Monthly plans with a fixed quote", "Working from your BizBooks records, with nothing lost in email", "Your money stays in your account. We never hold it."].map((t) => (
                <li key={t} className="flex gap-2"><Check className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
          <div id="consultation" className="scroll-mt-20 rounded-3xl border border-line bg-canvas p-5 sm:p-7">
            <h2 className="text-xl">Book a free consultation</h2>
            <p className="mb-5 mt-1 text-sm text-muted">Tell us a little about your company. We'll reply within one working day.</p>
            <AdvisorForm />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl">What we can take off your plate</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ADVISOR_SERVICES.map((s) => (
            <div key={s.key} className="flex flex-col rounded-3xl border border-line bg-paper p-6">
              <h3 className="text-xl">{s.name}</h3>
              <p className="mt-1 text-sm font-semibold text-brand-deep">{s.from ? `From ${naira(s.from)} / month` : "Fixed quote after a free review"}</p>
              <p className="mt-3 text-ink-soft">{s.blurb}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {s.includes.map((i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />{i}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">Starting prices. Your plan depends on transaction volume and team size.</p>
      </section>

      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl">How it works</h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              [MessagesSquare, "Free consultation", "A 30-minute call to understand your company, your current records and what's worrying you."],
              [ClipboardCheck, "Review and fixed quote", "We review your books and bank statements, then send a fixed monthly quote, plus a catch-up fee if needed."],
              [Repeat, "Monthly service", "Your advisor keeps the books, prepares filings before every deadline and walks you through your numbers each month."],
            ].map(([Icon, t, b], i) => {
              const I = Icon as typeof Repeat;
              return (
                <li key={t as string} className="rounded-2xl bg-canvas p-6">
                  <span className="num text-sm font-bold text-brand">Step {i + 1}</span>
                  <I className="mt-3 size-6 text-brand" aria-hidden />
                  <h3 className="mt-3 text-lg">{t as string}</h3>
                  <p className="mt-1 text-ink-soft">{b as string}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl">Questions</h2>
        <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-paper">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">{f.q}<span aria-hidden className="text-2xl font-normal text-muted group-open:rotate-45">+</span></summary>
              <p className="mt-3 text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-center">
          <Link href="#consultation" className="font-semibold text-brand underline">Book a free consultation</Link>{" "}
          <span className="text-muted">or read our free guides in </span><Link href="/insights" className="font-semibold text-brand underline">Insights</Link>
        </p>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Service",
            name: `${APP_NAME} Advisors`,
            serviceType: "Outsourced bookkeeping, tax compliance and payroll",
            areaServed: { "@type": "Country", name: "Nigeria" },
            provider: { "@type": "Organization", name: APP_NAME },
            hasOfferCatalog: {
              "@type": "OfferCatalog",
              name: "Advisory services",
              itemListElement: ADVISOR_SERVICES.map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s.name, description: s.blurb }, ...(s.from ? { priceSpecification: { "@type": "UnitPriceSpecification", price: s.from, priceCurrency: "NGN", unitText: "MONTH" } } : {}) })),
            },
          },
          { "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
        ],
      }) }} />
    </>
  );
}
