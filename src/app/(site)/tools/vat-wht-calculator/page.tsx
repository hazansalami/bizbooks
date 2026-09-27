import type { Metadata } from "next";
import Link from "next/link";
import { VatWhtCalculator } from "@/components/calculators";
import { ButtonLink } from "@/components/ui";

const faqs = [
  { q: "How do I calculate VAT in Nigeria?", a: "Multiply the amount before VAT by 7.5%. For a ₦1,000,000 invoice, VAT is ₦75,000 and the invoice total is ₦1,075,000." },
  { q: "Is WHT calculated on the amount including VAT?", a: "No. Withholding tax is calculated on the amount before VAT. On a ₦1,000,000 consultancy invoice with 5% WHT, the client deducts ₦50,000, not 5% of ₦1,075,000." },
  { q: "What WHT rate applies to consultancy and professional fees?", a: "5% for Nigerian resident recipients under the 2024 withholding regulations. Supply of goods and construction contracts are usually 2%, and rent, interest and dividends 10%." },
  { q: "What amount will my client actually pay?", a: "The invoice total (amount plus 7.5% VAT) minus the WHT they deduct. The WHT becomes a tax credit for you." },
];

export const metadata: Metadata = {
  title: "VAT and WHT calculator Nigeria: what your client actually pays",
  description: "Free calculator for Nigerian invoices: add 7.5% VAT, deduct 2%, 5% or 10% withholding tax, and see the invoice total and the amount your client will pay.",
  alternates: { canonical: "/tools/vat-wht-calculator" },
};

export default function VatWhtPage() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-4 pb-10 pt-12 sm:px-6">
        <p className="text-sm font-bold uppercase tracking-widest text-brand">Free tool</p>
        <h1 className="mt-2 text-4xl leading-[1.05] tracking-[-0.03em] sm:text-5xl">VAT & WHT invoice calculator</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">Work out the invoice total with 7.5% VAT, the withholding tax your client will deduct, and the amount that will actually land in your account.</p>
        <div className="mt-8"><VatWhtCalculator /></div>
      </section>
      <section className="border-t border-line bg-paper">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl">Questions</h2>
          <div className="mt-4 divide-y divide-line rounded-2xl border border-line">
            {faqs.map((f) => (
              <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">{f.q}<span aria-hidden className="text-xl text-muted group-open:rotate-45">+</span></summary>
                <p className="mt-2 text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-ink-soft">Learn more: <Link href="/insights/vat-in-nigeria-for-service-companies" className="font-semibold text-brand underline">VAT for service companies</Link> · <Link href="/insights/withholding-tax-in-nigeria" className="font-semibold text-brand underline">Withholding tax in Nigeria</Link></p>
          <div className="mt-12 rounded-3xl bg-ink p-6 text-white sm:p-8">
            <p className="text-xl font-bold">Stop calculating this by hand</p>
            <p className="mt-1 text-white/80">BizBooks adds VAT and WHT to every invoice, shows the amount payable, and tracks WHT credits and VAT due dates for you.</p>
            <ButtonLink href="/solutions/invoicing" variant="light" className="mt-5">See invoicing</ButtonLink>
          </div>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebApplication", name: "VAT and WHT invoice calculator Nigeria", applicationCategory: "FinanceApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "NGN" } },
          { "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
        ],
      }) }} />
    </>
  );
}
