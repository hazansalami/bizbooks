import type { Metadata } from "next";
import { NetToGrossCalculator } from "@/components/calculators";
import { ToolPage, type ToolContent } from "@/components/tool-page";

const c: ToolContent = {
  slug: "net-to-gross-salary-calculator",
  h1: "Net to gross salary calculator (Nigeria 2026)",
  intro: "Agreed a take-home figure with a candidate? Find the gross salary to put in the offer letter, after PAYE and pension under the 2026 rules.",
  howToTitle: "How to convert net salary to gross in Nigeria",
  howToIntro: "Because PAYE is progressive, you can't just add a percentage. You work backwards: find the gross pay whose take-home, after pension and PAYE, equals the net amount you've agreed.",
  steps: [
    { name: "Start with the agreed take-home", text: "The monthly amount the employee should receive after all deductions." },
    { name: "Estimate a gross figure", text: "A rough starting point is net ÷ 0.8 for mid-level salaries." },
    { name: "Calculate deductions on that gross", text: "Subtract 8% pension, any NHF, and PAYE using the 2026 bands (first ₦800,000 a year tax-free)." },
    { name: "Adjust and repeat", text: "If take-home is below target, raise the gross; if above, lower it. Repeat until it matches. This calculator does it instantly." },
  ],
  example: {
    title: "Worked example: ₦398,300 take-home, ₦1.2m rent",
    rows: [["Target take-home", "₦398,300"], ["Gross monthly salary needed", "₦500,000"], ["Pension (8%)", "₦40,000"], ["PAYE", "₦61,700"], ["Employer pension (10%) on top", "₦50,000"]],
  },
  faqs: [
    { q: "How do I convert net salary to gross in Nigeria?", a: "Work backwards from the agreed take-home: find the gross salary whose deductions (8% pension, NHF and PAYE under the 2026 bands) leave exactly that net amount. Because tax is progressive, it takes a few iterations, or a net-to-gross calculator." },
    { q: "Should offer letters state gross or net salary?", a: "State the gross salary, and its components (basic, housing, transport), because PAYE and pension are calculated on gross pay and can change with tax rules." },
    { q: "Does the employer pension come out of the gross?", a: "No. The employee's 8% comes out of gross pay. The employer's 10% is paid on top, so the real cost to the company is higher than the gross salary." },
  ],
  articles: ["how-to-calculate-paye-in-nigeria", "payroll-in-nigeria-first-time-employer-guide"],
  cta: { title: "Hiring more people?", body: "BizBooks payroll works out PAYE, pension and take-home for every team member, every month.", href: "/solutions/payroll", label: "See payroll" },
};

export const metadata: Metadata = {
  title: "Net to gross salary calculator Nigeria 2026: take-home to gross pay",
  description: "Free net-to-gross salary calculator for Nigeria. Enter the take-home pay you want to offer and get the gross salary after PAYE and pension under the 2026 tax bands.",
  alternates: { canonical: "/tools/net-to-gross-salary-calculator" },
};

export default function Page() {
  return <ToolPage c={c}><NetToGrossCalculator /></ToolPage>;
}
