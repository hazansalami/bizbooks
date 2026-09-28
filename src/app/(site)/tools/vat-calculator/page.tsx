import type { Metadata } from "next";
import { VatCalculator } from "@/components/calculators";
import { ToolPage, type ToolContent } from "@/components/tool-page";

const c: ToolContent = {
  slug: "vat-calculator",
  h1: "VAT calculator Nigeria (7.5%)",
  intro: "Add 7.5% VAT to a price, or take the VAT out of a VAT-inclusive total, in one step.",
  howToTitle: "How to calculate VAT in Nigeria",
  howToIntro: "Nigeria's VAT rate is 7.5%. To add VAT, multiply by 1.075. To remove VAT from a total, divide by 1.075. The difference is the VAT.",
  steps: [
    { name: "To add VAT", text: "Multiply the price before VAT by 7.5% to get the VAT, then add it on: price × 1.075 = VAT-inclusive total." },
    { name: "To remove VAT", text: "Divide the VAT-inclusive total by 1.075 to get the price before VAT. Subtract to find the VAT." },
    { name: "Show VAT separately", text: "On a VAT invoice, show the amount before VAT, the VAT at 7.5% and the total as separate lines." },
    { name: "File by the 21st", text: "VAT you charge in a month is filed and paid to the NRS by the 21st of the next month, less input VAT on your costs." },
  ],
  example: {
    title: "Worked examples",
    rows: [["Add VAT to ₦1,000,000", "₦1,075,000 (VAT ₦75,000)"], ["Remove VAT from ₦1,075,000", "₦1,000,000 (VAT ₦75,000)"], ["Remove VAT from ₦500,000", "₦465,116.28 (VAT ₦34,883.72)"]],
  },
  faqs: [
    { q: "What is the VAT rate in Nigeria?", a: "7.5%. The Nigeria Tax Act 2025 kept the rate unchanged from 2026." },
    { q: "How do I remove VAT from a total?", a: "Divide the total by 1.075. For example, ₦1,075,000 ÷ 1.075 = ₦1,000,000, so the VAT is ₦75,000." },
    { q: "Why isn't VAT just 7.5% of the total?", a: "Because the total already includes VAT. 7.5% of the VAT-inclusive total overstates the VAT; the VAT is 7.5% of the amount before VAT." },
    { q: "When is VAT paid in Nigeria?", a: "VAT returns and payments are due to the Nigeria Revenue Service by the 21st of the month after the supply." },
  ],
  articles: ["vat-in-nigeria-for-service-companies", "how-to-write-a-professional-invoice-in-nigeria"],
  cta: { title: "VAT worked out on every invoice", body: "BizBooks adds VAT, tracks input VAT on expenses and shows the VAT due each month with its deadline.", href: "/solutions/taxes", label: "See tax tracking" },
};

export const metadata: Metadata = {
  title: "VAT calculator Nigeria 7.5%: add or remove VAT (how to calculate VAT)",
  description: "Free 7.5% VAT calculator for Nigeria. Add VAT to a price or remove VAT from a total, with the formula and examples of how to calculate VAT.",
  alternates: { canonical: "/tools/vat-calculator" },
};

export default function Page() {
  return <ToolPage c={c}><VatCalculator /></ToolPage>;
}
