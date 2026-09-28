/*
  Free public calculators. Each one is an ungated page targeting "how to calculate …" searches,
  with an optional "email me my results" capture that sends a relevant bonus resource.
*/
export type ToolMeta = {
  slug: string;
  href: string;
  title: string;
  body: string;
  group: "Payroll" | "Tax" | "Invoicing";
  bonus: { label: string; href: string };
};

export const TOOLS: ToolMeta[] = [
  { slug: "paye-calculator", href: "/tools/paye-calculator", title: "PAYE calculator 2026", body: "Salary to PAYE, pension and take-home pay under the new tax bands.", group: "Payroll", bonus: { label: "The 2026 PAYE guide with worked examples", href: "/insights/how-to-calculate-paye-in-nigeria" } },
  { slug: "net-to-gross-salary-calculator", href: "/tools/net-to-gross-salary-calculator", title: "Net to gross salary calculator", body: "The gross salary to offer for a take-home figure you've agreed.", group: "Payroll", bonus: { label: "The first-time employer's payroll guide", href: "/insights/payroll-in-nigeria-first-time-employer-guide" } },
  { slug: "employer-cost-calculator", href: "/tools/employer-cost-calculator", title: "Cost of an employee calculator", body: "What a hire really costs: salary, employer pension, NSITF and ITF.", group: "Payroll", bonus: { label: "The first-time employer's payroll guide", href: "/insights/payroll-in-nigeria-first-time-employer-guide" } },
  { slug: "company-income-tax-calculator", href: "/tools/company-income-tax-calculator", title: "Company income tax calculator 2026", body: "CIT and 4% development levy, with the small-company 0% check.", group: "Tax", bonus: { label: "The 2026 tax calendar for companies", href: "/insights/nigeria-tax-calendar-2026" } },
  { slug: "vat-calculator", href: "/tools/vat-calculator", title: "VAT calculator Nigeria (7.5%)", body: "Add 7.5% VAT to a price, or take VAT out of a total.", group: "Tax", bonus: { label: "The VAT guide for service companies", href: "/insights/vat-in-nigeria-for-service-companies" } },
  { slug: "vat-wht-calculator", href: "/tools/vat-wht-calculator", title: "VAT & WHT invoice calculator", body: "What your client actually pays after VAT and withholding tax.", group: "Invoicing", bonus: { label: "The professional invoice checklist", href: "/insights/how-to-write-a-professional-invoice-in-nigeria" } },
];

export const TOOL_BY_SLUG: Record<string, ToolMeta> = Object.fromEntries(TOOLS.map((t) => [t.slug, t]));
