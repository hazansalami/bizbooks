import type { Metadata } from "next";
import { CompanyTaxCalculator } from "@/components/calculators";
import { ToolPage, type ToolContent } from "@/components/tool-page";

const c: ToolContent = {
  slug: "company-income-tax-calculator",
  h1: "Company income tax calculator Nigeria 2026",
  intro: "Check whether your company qualifies for 0% tax as a small company, and estimate company income tax and the 4% development levy under the Nigeria Tax Act 2025.",
  howToTitle: "How to calculate company income tax in Nigeria",
  howToIntro: "First check whether the company is a small company. If it isn't, company income tax is 30% of taxable profit and the development levy is 4% of assessable profit.",
  steps: [
    { name: "Check the small company tests", text: "Turnover of ₦100 million or less, fixed assets of ₦250 million or less, and no professional services. Pass all three and CIT is 0%, with no development levy." },
    { name: "Work out taxable profit", text: "Income minus allowable expenses and capital allowances, adjusted for items that aren't deductible for tax." },
    { name: "Apply 30% company income tax", text: "Taxable profit × 30% for companies that aren't small." },
    { name: "Add the 4% development levy", text: "Assessable profit (before capital allowances and losses) × 4%. It replaced four older levies from 2026." },
    { name: "File within 6 months of year end", text: "The return and payment are due within six months after your financial year end: 30 June for a December year end." },
  ],
  example: {
    title: "Worked example: consultancy with ₦85m turnover",
    rows: [["Turnover", "₦85,000,000"], ["Professional services?", "Yes, so not a small company"], ["Taxable profit", "₦12,000,000"], ["Company income tax (30%)", "₦3,600,000"], ["Development levy (4% of ₦12m)", "₦480,000"], ["Total", "₦4,080,000"]],
    note: "The same company doing non-professional work (such as a creative agency), with assets under ₦250m, would pay 0%.",
  },
  faqs: [
    { q: "What is the company income tax rate in Nigeria in 2026?", a: "30% of taxable profit for companies that aren't small, plus a 4% development levy on assessable profit. Small companies pay 0%." },
    { q: "What is a small company for tax purposes?", a: "Under the Nigeria Tax Act 2025, a company with turnover of ₦100 million or less and fixed assets of ₦250 million or less that doesn't provide professional services." },
    { q: "What is the development levy?", a: "A 4% levy on assessable profit for companies that aren't small, replacing Tertiary Education Tax, the IT levy, the NASENI levy and the Police Trust Fund levy." },
    { q: "When is company income tax due?", a: "The return and payment are due within six months after the end of the company's financial year." },
  ],
  articles: ["small-company-tax-exemption-nigeria", "nigeria-tax-act-2025-explained-for-companies", "nigeria-tax-calendar-2026"],
  cta: { title: "Watch your small-company status all year", body: "BizBooks tracks your trailing 12-month sales against the ₦100m limit and puts every tax deadline on a calendar.", href: "/solutions/taxes", label: "See tax tracking" },
};

export const metadata: Metadata = {
  title: "Company income tax calculator Nigeria 2026: CIT, development levy and small company check",
  description: "Free calculator for Nigerian company tax under the Nigeria Tax Act 2025: check the ₦100m small company exemption and estimate 30% CIT and the 4% development levy.",
  alternates: { canonical: "/tools/company-income-tax-calculator" },
};

export default function Page() {
  return <ToolPage c={c}><CompanyTaxCalculator /></ToolPage>;
}
