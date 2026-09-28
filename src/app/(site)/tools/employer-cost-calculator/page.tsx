import type { Metadata } from "next";
import { EmployerCostCalculator } from "@/components/calculators";
import { ToolPage, type ToolContent } from "@/components/tool-page";

const c: ToolContent = {
  slug: "employer-cost-calculator",
  h1: "How much does an employee cost in Nigeria?",
  intro: "The salary is only part of it. Add the employer pension, NSITF and ITF to see the real monthly and annual cost of a hire.",
  howToTitle: "How to calculate the cost of an employee in Nigeria",
  howToIntro: "The cost to the company is gross salary plus the statutory contributions the employer pays on top. PAYE and the employee's own pension come out of the salary, so they don't add to the cost.",
  steps: [
    { name: "Start with gross monthly salary", text: "Basic + housing + transport + other allowances." },
    { name: "Add employer pension (10%)", text: "Required when the company has 3 or more employees, under the Pension Reform Act 2014." },
    { name: "Add NSITF (1%)", text: "Employee Compensation Scheme contribution on monthly payroll." },
    { name: "Add ITF (1%)", text: "Industrial Training Fund, for employers with 5 or more staff or ₦50m+ turnover." },
    { name: "Multiply by 12", text: "That's the annual cost, before equipment, HMO, bonuses and other benefits." },
  ],
  example: {
    title: "Worked example: ₦400,000 salary, company with 6 staff",
    rows: [["Gross salary", "₦400,000"], ["Employer pension (10%)", "₦40,000"], ["NSITF (1%)", "₦4,000"], ["ITF (1%)", "₦4,000"], ["Monthly cost to company", "₦448,000"], ["Annual cost", "₦5,376,000"]],
    note: "Health insurance, equipment, 13th-month pay and other benefits come on top if you offer them.",
  },
  faqs: [
    { q: "How much does it cost to employ someone in Nigeria?", a: "Roughly gross salary plus 10% employer pension (from 3 employees), 1% NSITF and 1% ITF (from 5 employees or ₦50m turnover): about 112% of salary, before benefits such as HMO and equipment." },
    { q: "Is PAYE an employer cost?", a: "No. PAYE is deducted from the employee's salary and remitted by the employer. It doesn't increase the cost to the company." },
    { q: "When does pension become compulsory?", a: "Under the Pension Reform Act 2014, employers with 3 or more employees must pay 10% employer pension and deduct 8% from employees." },
  ],
  articles: ["payroll-in-nigeria-first-time-employer-guide", "employee-or-contractor-nigeria"],
  cta: { title: "Know your payroll cost every month", body: "BizBooks shows your total payroll cost, runs payroll and records it in your books automatically.", href: "/solutions/payroll", label: "See payroll" },
};

export const metadata: Metadata = {
  title: "Cost of an employee in Nigeria calculator (salary, pension, NSITF, ITF)",
  description: "Free calculator: what an employee really costs a Nigerian company each month and year, including 10% employer pension, 1% NSITF and 1% ITF.",
  alternates: { canonical: "/tools/employer-cost-calculator" },
};

export default function Page() {
  return <ToolPage c={c}><EmployerCostCalculator /></ToolPage>;
}
