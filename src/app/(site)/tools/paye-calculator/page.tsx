import type { Metadata } from "next";
import Link from "next/link";
import { PayeCalculator } from "@/components/calculators";
import { ButtonLink } from "@/components/ui";

const faqs = [
  { q: "How is PAYE calculated in Nigeria in 2026?", a: "Annual gross pay minus pension (8%), NHF and rent relief gives taxable income. The first ₦800,000 is taxed at 0%, the next ₦2.2m at 15%, then 18%, 21%, 23% and 25% on higher bands. Divide by 12 for monthly PAYE." },
  { q: "What is the tax-free amount in Nigeria?", a: "The first ₦800,000 of annual taxable income is taxed at 0% under the Nigeria Tax Act 2025, from 1 January 2026." },
  { q: "What is rent relief?", a: "From 2026, employees can deduct 20% of the annual rent they pay, up to ₦500,000, before PAYE is calculated. It replaced the Consolidated Relief Allowance." },
  { q: "Is this calculator accurate for my payroll?", a: "It follows the published 2026 bands and treats total gross pay as pensionable. Real payslips can differ if pension is calculated only on basic, housing and transport, or if other reliefs apply." },
];

export const metadata: Metadata = {
  title: "PAYE calculator Nigeria 2026: take-home pay under the new tax bands",
  description: "Free PAYE calculator for Nigeria using the 2026 tax bands (Nigeria Tax Act 2025): enter a salary to see PAYE, pension, rent relief and take-home pay.",
  alternates: { canonical: "/tools/paye-calculator" },
};

export default function PayeCalculatorPage() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-4 pb-10 pt-12 sm:px-6">
        <p className="text-sm font-bold uppercase tracking-widest text-brand">Free tool</p>
        <h1 className="mt-2 text-4xl leading-[1.05] tracking-[-0.03em] sm:text-5xl">PAYE calculator for 2026</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">See PAYE, pension and take-home pay under the new tax bands that took effect on 1 January 2026, including the ₦800,000 tax-free threshold and rent relief.</p>
        <div className="mt-8"><PayeCalculator /></div>
      </section>

      <section className="border-t border-line bg-paper">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl">The 2026 PAYE bands</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
            <table className="num w-full text-sm">
              <thead className="bg-canvas text-left"><tr><th scope="col" className="p-3">Annual taxable income</th><th scope="col" className="p-3">Rate</th></tr></thead>
              <tbody>
                {[["First ₦800,000", "0%"], ["₦800,001 – ₦3,000,000", "15%"], ["₦3,000,001 – ₦12,000,000", "18%"], ["₦12,000,001 – ₦25,000,000", "21%"], ["₦25,000,001 – ₦50,000,000", "23%"], ["Above ₦50,000,000", "25%"]].map(([b, r]) => (
                  <tr key={b} className="border-t border-line"><td className="p-3">{b}</td><td className="p-3 font-semibold">{r}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-ink-soft">For the full method with worked examples, read <Link href="/insights/how-to-calculate-paye-in-nigeria" className="font-semibold text-brand underline">how to calculate PAYE in Nigeria</Link>.</p>

          <h2 className="mt-12 text-2xl">Questions</h2>
          <div className="mt-4 divide-y divide-line rounded-2xl border border-line">
            {faqs.map((f) => (
              <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">{f.q}<span aria-hidden className="text-xl text-muted group-open:rotate-45">+</span></summary>
                <p className="mt-2 text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-12 rounded-3xl bg-ink p-6 text-white sm:p-8">
            <p className="text-xl font-bold">Running payroll for a team?</p>
            <p className="mt-1 text-white/80">BizBooks calculates PAYE, pension and NHF for everyone, creates payslips and a bank upload file, and reminds you to remit.</p>
            <ButtonLink href="/solutions/payroll" variant="light" className="mt-5">See payroll</ButtonLink>
          </div>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebApplication", name: "PAYE calculator Nigeria 2026", applicationCategory: "FinanceApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "NGN" } },
          { "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
        ],
      }) }} />
    </>
  );
}
