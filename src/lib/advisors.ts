/*
  BizBooks Advisors: done-for-you bookkeeping, tax and payroll by the BizBooks team (like Wave Advisors).
  PRICES ARE PLACEHOLDERS. Confirm with the advisory team before launch.
*/
export const ADVISOR_SERVICES = [
  {
    key: "BOOKKEEPING",
    name: "Monthly bookkeeping",
    from: 150_000,
    blurb: "We record, categorise and reconcile everything each month and send you a clear monthly report.",
    includes: ["Bank reconciliation for every account", "Expenses, bills and receipts categorised", "Month-end close and management accounts", "A monthly call to walk through your numbers"],
  },
  {
    key: "TAX",
    name: "Tax & compliance",
    from: 100_000,
    blurb: "VAT, WHT, PAYE and pension filed on time, with annual returns and tax clearance handled.",
    includes: ["Monthly VAT returns and WHT remittance schedules", "PAYE and pension remittance support", "Company income tax and development levy returns", "Tax clearance certificate (TCC) applications"],
  },
  {
    key: "PAYROLL",
    name: "Payroll management",
    from: 75_000,
    blurb: "We run payroll for you every month, from payslips to statutory remittances.",
    includes: ["Monthly payroll for staff and contractors", "PAYE, pension, NHF, NSITF and ITF schedules", "Payslips and bank upload files", "Annual employer returns (Form H1)"],
  },
  {
    key: "CFO",
    name: "Fractional CFO",
    from: 400_000,
    blurb: "Senior finance support for growing companies: budgets, forecasts, pricing and investor reporting.",
    includes: ["Budgets and 13-week cash flow forecasts", "Pricing and margin analysis", "Board and investor reports", "Fundraising and loan preparation"],
  },
  {
    key: "CLEANUP",
    name: "Catch-up & clean-up",
    from: null,
    blurb: "Behind on your books? We bring past months or years up to date, ready for audit and tax.",
    includes: ["Reconstruct records from bank statements", "Fix mis-categorised transactions", "Prepare for audit and back-filed returns", "Fixed quote after a free review"],
  },
] as const;

export type AdvisorServiceKey = (typeof ADVISOR_SERVICES)[number]["key"];
