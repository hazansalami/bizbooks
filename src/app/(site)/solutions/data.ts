export type Solution = {
  slug: string;
  group: "Stay organized & tax-ready" | "Get paid" | "Pay your team";
  name: string;
  menu: string;
  title: string;
  headline: string;
  sub: string;
  points: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
};

/*
  Solutions grouped the way Wave groups them. Copy is written for registered companies
  (agencies, consultancies, B2B services) that invoice as a matter of course.
  No invented statistics or testimonials.
*/
export const SOLUTIONS: Solution[] = [
  {
    slug: "accounting",
    group: "Stay organized & tax-ready",
    name: "Bookkeeping & reports",
    menu: "Know where the company stands, every day",
    title: "Bookkeeping and financial reports for Nigerian companies",
    headline: "Books your accountant will thank you for.",
    sub: "Every invoice, payment, expense, bill and pay run lands in one set of books. Your profit, cash flow and who-owes-what are always up to date, without a spreadsheet in sight.",
    points: [
      { title: "A dashboard that answers the real questions", body: "Cash flow, profit and loss, overdue invoices, bills you owe and what's due in the next 30 days, all on one screen." },
      { title: "Accrual or cash, your choice", body: "See profit the way your accountant does (when you invoice) or the way your bank does (when money moves). Switch with one tap." },
      { title: "The reports people ask for", body: "Profit & Loss, Cash Flow, VAT, Aged Receivables and Payables, Income by Client, Purchases by Supplier and Payroll Summary." },
      { title: "Accountant-ready exports", body: "Send your accountant one CSV with every transaction for the month or year, instead of a folder of screenshots." },
    ],
    faqs: [
      { q: "Do I need to know accounting?", a: "No. You record what happened (you sent an invoice, you paid a bill, you ran payroll) and BizBooks puts it in the right place. Reports are written in plain English." },
      { q: "Can my accountant use it?", a: "Yes. Every report prints to PDF, and Pro exports every transaction as a CSV they can load into their own tools." },
      { q: "Is there a balance sheet?", a: "Not yet. A full balance sheet needs bank feeds and a complete ledger, and both are on the way. Until then, the profit & loss, cash flow and aging reports cover the day-to-day." },
    ],
  },
  {
    slug: "expenses",
    group: "Stay organized & tax-ready",
    name: "Expenses, bills & receipts",
    menu: "Track spending and never miss a bill",
    title: "Expense tracking, bills and receipts",
    headline: "Know exactly where the money goes.",
    sub: "Record expenses in seconds with a photo of the receipt, keep supplier bills until they're paid, and set fixed costs like rent and software to record themselves.",
    points: [
      { title: "Recurring expenses", body: "Office rent, software subscriptions, internet and diesel supply. Enter them once and they're logged on their due date." },
      { title: "Bills you owe", body: "Record a supplier invoice as “not paid yet”, see it on your dashboard until it's due, then mark it paid in one tap." },
      { title: "Receipt photos", body: "Snap the receipt on your phone. It's shrunk, stored with the expense, and ready when your accountant or the tax office asks." },
      { title: "Input VAT tracked", body: "Note the VAT on supplier invoices and BizBooks offsets it against the VAT you charge." },
    ],
    faqs: [
      { q: "What's the difference between an expense and a bill?", a: "An expense is already paid. A bill is something you owe and will pay later. Bills show up in “Bills you owe” with their due date until you mark them paid." },
      { q: "Do I have to enter salaries as expenses?", a: "No. Payroll records salaries and employer pension for you each month when you mark a pay run as paid." },
    ],
  },
  {
    slug: "taxes",
    group: "Stay organized & tax-ready",
    name: "Tax tracking",
    menu: "VAT, PAYE, WHT and pension deadlines",
    title: "Tax tracking for Nigerian companies: VAT, PAYE, WHT, pension",
    headline: "Never get surprised by a tax deadline again.",
    sub: "BizBooks works out the VAT, PAYE, pension and withholding tax your company owes from your invoices, bills and payroll, shows when each is due, and tells you how much to keep aside.",
    points: [
      { title: "A tax calendar that fills itself", body: "VAT by the 21st, PAYE by the 10th, pension within 7 working days of pay day, WHT by the 21st, with the amount for each." },
      { title: "Updated for the 2026 tax rules", body: "PAYE uses the Nigeria Tax Act 2025 bands, with the first ₦800,000 a year tax-free and rent relief included." },
      { title: "WHT both ways", body: "Track withholding tax clients deduct from you (a credit you can use) and the WHT you deduct from contractors." },
      { title: "Small-company check", body: "See whether your turnover keeps you in the 0% company income tax bracket, and what changes if you provide professional services." },
    ],
    faqs: [
      { q: "Does BizBooks file my taxes?", a: "No. It works out the amounts and deadlines and gives you the reports. You or your accountant file and pay through the tax authorities' own channels, then mark each one as remitted." },
      { q: "How accurate are the figures?", a: "They follow the published 2026 rules and your own records, so they're only as complete as what you've recorded. They're estimates to plan with; your accountant should confirm before you file." },
    ],
  },
  {
    slug: "invoicing",
    group: "Get paid",
    name: "Invoicing",
    menu: "Professional invoices clients pay on time",
    title: "Invoicing software for Nigerian companies",
    headline: "Invoices your clients' accounts teams can actually process.",
    sub: "Your logo, CAC number and TIN, the client's PO number, VAT and withholding tax worked out, and a secure “Pay now” link. Sent by email in one click.",
    points: [
      { title: "Everything finance teams check", body: "RC number, TIN, client TIN, PO reference, VAT at 7.5% and WHT at 2%, 5% or 10%, with the amount in words." },
      { title: "Recurring invoices", body: "Retainers and monthly contracts go out on their own, on schedule, with a payment link every time." },
      { title: "Automatic reminders", body: "Polite reminders before and after the due date, so nobody on your team has to chase." },
      { title: "See when they've opened it", body: "Know when a client has viewed the invoice, and get told the moment they pay or say they've transferred." },
    ],
    faqs: [
      { q: "Can I invoice clients who deduct withholding tax?", a: "Yes. Choose the WHT rate on the invoice (usually 5% for consultancy and professional fees, 2% for supply contracts). It shows the total, the WHT they'll deduct and the balance they'll actually send, so there's no back-and-forth." },
      { q: "Can I still send invoices by WhatsApp?", a: "Yes. Every invoice has a WhatsApp button and a link you can paste anywhere, alongside email." },
    ],
  },
  {
    slug: "quotes",
    group: "Get paid",
    name: "Quotes & deposits",
    menu: "Win projects and collect deposits upfront",
    title: "Quotes and deposits for agencies and service companies",
    headline: "Win the project. Collect the deposit. Start the work.",
    sub: "Send a professional quote your client can accept online. If you ask for a mobilisation deposit, they pay it straight away, and it's credited on the final invoice automatically.",
    points: [
      { title: "Accept online", body: "Clients review the quote and accept with their name. You're notified immediately." },
      { title: "Deposits on acceptance", body: "Ask for 30%, 50% or 70% upfront. The deposit invoice is raised and paid in the same step." },
      { title: "One tap to invoice", body: "Turn the accepted quote into the final invoice, with the deposit already deducted." },
      { title: "Know your win rate", body: "See what's waiting on clients, what you've won, and your acceptance rate." },
    ],
    faqs: [
      { q: "What happens to VAT on the deposit?", a: "The deposit invoice carries VAT on the deposit amount. The final invoice charges VAT only on the balance, so VAT is never charged twice." },
    ],
  },
  {
    slug: "payments",
    group: "Get paid",
    name: "Online payments",
    menu: "Get paid through your own Paystack or Flutterwave",
    title: "Online invoice payments with Paystack and Flutterwave",
    headline: "Get paid online, straight into your own account.",
    sub: "Connect your company's Paystack or Flutterwave account and every invoice gets a secure “Pay now” link for card, bank transfer and USSD. The money never passes through BizBooks.",
    points: [
      { title: "Your account, your money", body: "Payments go from the client to your Paystack or Flutterwave balance and settle to your bank on your usual schedule." },
      { title: "Marked paid automatically", body: "Online payments are checked with the gateway and recorded against the invoice without anyone lifting a finger." },
      { title: "Transfers without the screenshots", body: "Your account number is on every invoice with a copy button, and clients tap “I've sent the transfer” so you know to check." },
      { title: "No extra fees from us", body: "You pay Paystack's or Flutterwave's standard rates. BizBooks adds nothing on top." },
    ],
    faqs: [
      { q: "Does BizBooks hold our money?", a: "No. We never receive, hold or move client payments. We only create the payment link with your key and confirm the result with your gateway." },
      { q: "Are our API keys safe?", a: "Secret keys are encrypted before they're stored, never shown in full again, and you can disconnect them at any time." },
    ],
  },
  {
    slug: "payroll",
    group: "Pay your team",
    name: "Payroll",
    menu: "Pay staff and contractors with PAYE worked out",
    title: "Payroll software for Nigerian companies: PAYE, pension, payslips",
    headline: "Payroll that works out the tax for you.",
    sub: "Add your staff and contractors once. Every month BizBooks works out PAYE, pension, NHF and withholding tax, produces payslips and a bank upload file, and records it all in your books.",
    points: [
      { title: "PAYE under the 2026 rules", body: "The Nigeria Tax Act 2025 bands, the ₦800,000 tax-free threshold, rent relief and pension relief, calculated per person." },
      { title: "Staff and contractors", body: "Salaried staff get PAYE and pension. Contractors get withholding tax. Both are on the same pay run." },
      { title: "Payslips and bank schedule", body: "A payslip link for every person, emailed if you like, and a CSV to upload to your bank's bulk transfer." },
      { title: "Straight into your books", body: "Mark the run paid and salaries and employer pension appear in your expenses, profit and tax calendar." },
    ],
    faqs: [
      { q: "Does BizBooks pay my staff?", a: "No. You pay from your own bank, usually by uploading the bank schedule we give you. That keeps your money under your control." },
      { q: "Does it remit PAYE and pension?", a: "It tells you exactly how much to remit and by when, and reminds you on the tax calendar. You remit through your state IRS and each employee's PFA." },
    ],
  },
];

export const SOLUTION_GROUPS = ["Stay organized & tax-ready", "Get paid", "Pay your team"] as const;
