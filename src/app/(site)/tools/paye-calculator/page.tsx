import type { Metadata } from "next";
import { PayeCalculator } from "@/components/calculators";
import { ToolPage, type ToolContent } from "@/components/tool-page";

const c: ToolContent = {
  slug: "paye-calculator",
  h1: "PAYE calculator Nigeria 2026",
  intro: "Work out PAYE, pension and take-home pay under the new tax bands that took effect on 1 January 2026, including the ₦800,000 tax-free threshold and rent relief.",
  howToTitle: "How to calculate PAYE in Nigeria",
  howToIntro: "PAYE is worked out on annual taxable income using the 2026 bands in the Nigeria Tax Act 2025, then divided by 12 for the monthly deduction.",
  steps: [
    { name: "Find annual gross pay", text: "Monthly gross (basic + housing + transport + other taxable allowances) × 12." },
    { name: "Subtract pension and NHF", text: "Deduct the employee's 8% pension contribution, and 2.5% NHF if they're registered." },
    { name: "Subtract rent relief", text: "Deduct 20% of the annual rent the employee pays, up to ₦500,000, with evidence." },
    { name: "Apply the tax bands", text: "0% on the first ₦800,000, 15% on the next ₦2.2m, 18% up to ₦12m, 21% up to ₦25m, 23% up to ₦50m and 25% above." },
    { name: "Divide by 12", text: "The annual tax ÷ 12 is the PAYE to deduct each month and remit to the State IRS by the 10th." },
  ],
  example: {
    title: "Worked example: ₦500,000 a month, ₦1.2m rent",
    rows: [["Annual gross", "₦6,000,000"], ["Less pension (8%)", "−₦480,000"], ["Less rent relief (20% of ₦1.2m)", "−₦240,000"], ["Taxable income", "₦5,280,000"], ["Tax: 15% × ₦2.2m + 18% × ₦2.28m", "₦740,400"], ["Monthly PAYE", "₦61,700"], ["Monthly take-home", "₦398,300"]],
  },
  faqs: [
    { q: "How is PAYE calculated in Nigeria in 2026?", a: "Take annual gross pay, subtract pension (8%), NHF and rent relief, then apply the bands: 0% on the first ₦800,000, 15% on the next ₦2.2m, 18% to ₦12m, 21% to ₦25m, 23% to ₦50m and 25% above. Divide by 12 for monthly PAYE." },
    { q: "What is the tax-free threshold in Nigeria?", a: "The first ₦800,000 of annual taxable income is taxed at 0% from 1 January 2026." },
    { q: "What is rent relief?", a: "20% of the annual rent an employee pays, up to ₦500,000, deducted before PAYE is calculated. It replaced the Consolidated Relief Allowance." },
    { q: "Do minimum wage earners pay PAYE?", a: "Generally no. At ₦70,000 a month, taxable income after pension is below the ₦800,000 tax-free threshold." },
    { q: "Where is PAYE paid?", a: "To the State Internal Revenue Service of the state where the employee lives, by the 10th of the following month." },
  ],
  articles: ["how-to-calculate-paye-in-nigeria", "payroll-in-nigeria-first-time-employer-guide", "employee-or-contractor-nigeria"],
  cta: { title: "Running payroll for a team?", body: "BizBooks calculates PAYE, pension and NHF for everyone, creates payslips and a bank upload file, and reminds you to remit.", href: "/solutions/payroll", label: "See payroll" },
};

export const metadata: Metadata = {
  title: "PAYE calculator Nigeria 2026: how to calculate PAYE (new tax bands)",
  description: "Free PAYE calculator for Nigeria using the 2026 tax bands. Enter a salary to see PAYE, pension, rent relief and take-home pay, plus how to calculate PAYE step by step.",
  alternates: { canonical: "/tools/paye-calculator" },
};

export default function Page() {
  return <ToolPage c={c}><PayeCalculator /></ToolPage>;
}
