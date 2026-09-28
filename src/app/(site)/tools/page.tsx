import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator } from "lucide-react";
import { TOOLS } from "@/lib/tools";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Free tax and payroll calculators for Nigeria (2026)",
  description: "Free Nigerian calculators: PAYE 2026, net to gross salary, cost of an employee, company income tax and small company check, VAT and withholding tax.",
  alternates: { canonical: "/tools" },
};

const GROUPS = ["Payroll", "Tax", "Invoicing"] as const;

export default function Tools() {
  const base = siteUrl();
  return (
    <>
      <section className="border-b border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-14 sm:px-6">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-brand"><Calculator className="size-4" aria-hidden />Free calculators</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-[1.05] tracking-[-0.03em] sm:text-5xl">Nigerian tax and payroll calculators, updated for 2026.</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-soft">Quick answers to the questions every company owner asks: how much PAYE, what a hire really costs, how much company tax, and what a client will actually pay. Free, with no sign-up.</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-6">
        {GROUPS.map((g) => (
          <section key={g} aria-labelledby={`g-${g}`}>
            <h2 id={`g-${g}`} className="text-2xl">{g}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {TOOLS.filter((t) => t.group === g).map((t) => (
                <Link key={t.slug} href={t.href} className="group flex flex-col rounded-3xl border border-line bg-paper p-6 hover:border-ink">
                  <h3 className="text-xl group-hover:text-brand-deep">{t.title}</h3>
                  <p className="mt-2 flex-1 text-ink-soft">{t.body}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">Open calculator <ArrowRight className="size-4" aria-hidden /></span>
                </Link>
              ))}
            </div>
          </section>
        ))}
        <p className="text-sm text-muted">Calculators give estimates based on published Nigerian rules as of 2026 and aren't tax advice. See our <Link href="/terms" className="underline">terms</Link>.</p>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Free Nigerian tax and payroll calculators",
        itemListElement: TOOLS.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.title, url: new URL(t.href, base).toString() })),
      }) }} />
    </>
  );
}
