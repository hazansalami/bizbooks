import type { Metadata } from "next";
import { VatWhtCalculator } from "@/components/calculators";
import { ToolPage, type ToolContent } from "@/components/tool-page";

const c: ToolContent = {
  slug: "vat-wht-calculator",
  h1: "VAT & withholding tax invoice calculator",
  intro: "Work out the invoice total with 7.5% VAT, the withholding tax your client will deduct, and the amount that will actually land in your account.",
  howToTitle: "How to calculate VAT and WHT on an invoice",
  howToIntro: "Add VAT to the amount before VAT, then deduct withholding tax, which is also calculated on the amount before VAT, never on the VAT.",
  steps: [
    { name: "Start with the amount before VAT", text: "The value of your services or goods." },
    { name: "Add VAT at 7.5%", text: "Amount × 7.5% = VAT. Amount + VAT = invoice total." },
    { name: "Work out WHT on the amount before VAT", text: "5% for consultancy, professional, technical and management fees; 2% for supply of goods and construction; 10% for rent, interest and dividends." },
    { name: "Subtract WHT from the total", text: "Invoice total − WHT = what the client pays. Show both on the invoice to avoid disputes." },
    { name: "Collect the WHT credit note", text: "The WHT deducted is a credit against your own income tax, but only with the credit note." },
  ],
  example: {
    title: "Worked example: ₦1,000,000 consultancy invoice",
    rows: [["Amount before VAT", "₦1,000,000"], ["VAT (7.5%)", "₦75,000"], ["Invoice total", "₦1,075,000"], ["WHT (5% of ₦1,000,000)", "−₦50,000"], ["Client pays", "₦1,025,000"]],
  },
  faqs: [
    { q: "How do I calculate WHT on an invoice?", a: "Multiply the amount before VAT by the WHT rate (5% for consultancy and professional fees to residents), then subtract it from the invoice total. WHT is never calculated on VAT." },
    { q: "What WHT rate applies to consultancy fees in Nigeria?", a: "5% for Nigerian residents under the 2024 withholding regulations. Supply of goods and construction contracts are 2%, and rent, interest and dividends 10%." },
    { q: "Is WHT an extra cost?", a: "No. WHT is an advance payment of your income tax. Use the credit note to offset it against your own tax." },
  ],
  articles: ["withholding-tax-in-nigeria", "how-to-write-a-professional-invoice-in-nigeria", "vat-in-nigeria-for-service-companies"],
  cta: { title: "Stop calculating this by hand", body: "BizBooks adds VAT and WHT to every invoice, shows the amount payable, and tracks WHT credits and VAT deadlines.", href: "/solutions/invoicing", label: "See invoicing" },
};

export const metadata: Metadata = {
  title: "VAT and WHT calculator Nigeria: how to calculate withholding tax on an invoice",
  description: "Free calculator for Nigerian invoices: add 7.5% VAT, deduct 2%, 5% or 10% withholding tax, and see the amount your client will actually pay.",
  alternates: { canonical: "/tools/vat-wht-calculator" },
};

export default function Page() {
  return <ToolPage c={c}><VatWhtCalculator /></ToolPage>;
}
