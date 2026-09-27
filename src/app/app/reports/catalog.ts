export type ReportSlug =
  | "profit-and-loss" | "cash-flow" | "vat" | "taxes" | "income-by-client" | "aged-receivables" | "client-deposits"
  | "purchases-by-supplier" | "aged-payables" | "payroll-summary" | "transactions" | "balance-sheet" | "trial-balance";

type Entry = { slug: ReportSlug; title: string; blurb: string; soon?: boolean };

/** Same shape as Wave's reports page, plus payroll. Double-entry statements come with the ledger. */
export const REPORT_GROUPS: { title: string; blurb: string; reports: Entry[] }[] = [
  {
    title: "Financial statements",
    blurb: "A clear picture of how the company is doing.",
    reports: [
      { slug: "profit-and-loss", title: "Profit & Loss (Income Statement)", blurb: "Income, expenses and net profit for any period, on an accrual or cash basis." },
      { slug: "cash-flow", title: "Cash Flow", blurb: "Money that came in and went out, month by month, and the net change." },
      { slug: "balance-sheet", title: "Balance Sheet", blurb: "What the company owns and owes on a given day. Arrives with bank feeds and the full ledger.", soon: true },
    ],
  },
  {
    title: "Taxes",
    blurb: "What you've charged and paid in tax, ready for your returns.",
    reports: [
      { slug: "vat", title: "VAT Report", blurb: "VAT charged on invoices and paid on expenses, and the balance to file by the 21st." },
      { slug: "taxes", title: "Tax calendar", blurb: "VAT, PAYE, pension and withholding tax deadlines, with amounts to set aside." },
    ],
  },
  {
    title: "Clients",
    blurb: "Your most valuable clients, who pays late, and money held for clients.",
    reports: [
      { slug: "income-by-client", title: "Income by Client", blurb: "Invoiced, paid and still owed, for every client." },
      { slug: "aged-receivables", title: "Aged Receivables", blurb: "Unpaid invoices by client: coming due, 30, 60 and 90+ days late." },
      { slug: "client-deposits", title: "Client Deposits", blurb: "Deposits paid on accepted quotes that haven't been invoiced yet." },
    ],
  },
  {
    title: "Suppliers",
    blurb: "Where the money goes, and what you still owe.",
    reports: [
      { slug: "purchases-by-supplier", title: "Purchases by Supplier", blurb: "Spend with every supplier, paid and unpaid." },
      { slug: "aged-payables", title: "Aged Payables", blurb: "Unpaid bills: coming due, 30, 60 and 90+ days overdue." },
    ],
  },
  {
    title: "Payroll",
    blurb: "Staff and contractor costs, with the taxes deducted.",
    reports: [
      { slug: "payroll-summary", title: "Payroll Summary", blurb: "Gross pay, PAYE, pension, WHT and take-home by month and by person." },
    ],
  },
  {
    title: "Detailed reporting",
    blurb: "Every transaction, for checking and for your accountant.",
    reports: [
      { slug: "transactions", title: "All Transactions", blurb: "Every payment received and expense paid, in date order." },
      { slug: "trial-balance", title: "Trial Balance", blurb: "Debits and credits by account. Arrives with the full ledger.", soon: true },
    ],
  },
];

export const REPORT_TITLES = Object.fromEntries(REPORT_GROUPS.flatMap((g) => g.reports.map((r) => [r.slug, r.title]))) as Record<ReportSlug, string>;
