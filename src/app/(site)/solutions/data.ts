import { computePay } from "@/lib/payroll";
import { computeTotals, naira } from "@/lib/money";
import { paystackFee, PLATFORM_FEE } from "@/lib/fees";
import { PLANS, TRIAL } from "@/lib/constants";

/*
  Solutions pages, written as landing pages: the problem in the reader's words, the outcome, proof by
  worked example, objections answered, one call to action. Written for registered companies (agencies,
  consultancies, B2B services) that invoice as a matter of course.
  Rules: no invented statistics or testimonials. Every number is either a published rule (rates and
  deadlines from the Nigeria Tax Act 2025 and existing law) or worked out by BizBooks' own code below.
*/

export type Solution = {
  slug: string;
  group: "Stay organized & tax-ready" | "Get paid" | "Pay your team";
  /** Short name for menus and cards. */
  name: string;
  menu: string;
  /** SEO title and meta description. */
  title: string;
  description: string;
  eyebrow: string;
  headline: string;
  sub: string;
  /** A self-contained answer to "What is …?", 40–60 words, for readers and AI answers alike. */
  answer: { q: string; a: string };
  pains: { title: string; body: string }[];
  /** Why it matters: the cost of leaving the problem alone. */
  stakes: string;
  compare: { without: string; with: string }[];
  benefits: { title: string; body: string }[];
  steps: { title: string; body: string }[];
  example: { title: string; intro: string; rows: { label: string; value: string; strong?: boolean }[]; note: string };
  faqs: { q: string; a: string }[];
  /** Free calculators and guides that go deeper. */
  resources: { label: string; href: string }[];
  close: { headline: string; sub: string };
};

const vatInvoice = computeTotals([{ description: "Brand strategy retainer", quantity: 1, unitPrice: 1_000_000 }], 0, 7.5, 5);
const pay = computePay({ kind: "EMPLOYEE", monthlyGross: 500_000, pension: true, nhf: false, annualRent: 1_200_000, whtRate: 0 });
const deposit = computeTotals([{ description: "Deposit (50%)", quantity: 1, unitPrice: 1_500_000 }], 0, 7.5, 0);
const balance = computeTotals([{ description: "Website build", quantity: 1, unitPrice: 3_000_000 }, { description: "Less deposit invoiced", quantity: 1, unitPrice: -1_500_000 }], 0, 7.5, 0);
const invoiceAmount = 250_000;
const contractorWht = 300_000 * 0.05;
const gatewayFee = paystackFee(invoiceAmount);

export const SOLUTIONS: Solution[] = [
  {
    slug: "invoicing",
    group: "Get paid",
    name: "Invoicing",
    menu: "Professional invoices clients pay on time",
    title: "Invoicing software for Nigerian companies, with VAT and WHT done right",
    description: "Send invoices with your RC number, TIN, VAT and withholding tax worked out and a Pay now link. Automatic reminders, recurring retainers and WhatsApp sharing. Free to start.",
    eyebrow: "Invoicing for Nigerian companies",
    headline: "Get paid without the back-and-forth.",
    sub: "Invoices that clear a client's accounts team the first time: your RC number and TIN, their PO number, VAT and withholding tax worked out, and a Pay now link. Then reminders go out for you, so nobody on your team has to chase.",
    answer: {
      q: "What does BizBooks invoicing do?",
      a: "BizBooks creates invoices that meet what Nigerian finance teams check (RC number, TIN, PO number, 7.5% VAT and 2%, 5% or 10% withholding tax), sends them by email or WhatsApp with a Pay now link, reminds clients before and after the due date, and records payments in your books automatically.",
    },
    pains: [
      { title: "“Please resend with our PO number.”", body: "An invoice missing a TIN, a PO reference or the right VAT line goes back to the bottom of the pile, and your payment date moves with it." },
      { title: "The withholding tax surprise", body: "You invoice ₦1,075,000, the client sends ₦1,025,000, and someone spends an afternoon working out whether you were short-paid or it was WHT." },
      { title: "Chasing is a part-time job", body: "Somebody has to remember who owes what, send the reminder, check the bank app and match the transfer to the right invoice." },
    ],
    stakes: "Every day an invoice sits unpaid is working capital your company is lending to its clients for free. Most late payments aren't refusals; they're invoices that got stuck, got lost or never got a reminder.",
    compare: [
      { without: "Invoices built in Word or Excel, numbered by hand", with: "Numbered automatically, with your logo, RC number and TIN on every one" },
      { without: "WHT worked out (or not) on a calculator", with: "Total, WHT the client deducts and balance they send, shown on the invoice" },
      { without: "“Did they get it?” WhatsApp messages", with: "See when the client opened it, and get told the moment they pay" },
      { without: "Reminders sent when someone remembers", with: "Polite reminders before and after the due date, automatically" },
      { without: "Matching transfers to invoices from screenshots", with: "Online payments marked paid on their own; transfers confirmed in one tap" },
    ],
    benefits: [
      { title: "Accepted by finance teams first time", body: "RC number, your TIN and theirs, PO reference, VAT at 7.5%, WHT at 2%, 5% or 10%, and the amount in words: everything an accounts payable desk looks for." },
      { title: "Paid in one tap", body: "Every invoice carries a Pay now link for card, transfer and USSD, plus your account number with a copy button for clients who'd rather transfer." },
      { title: "Retainers that send themselves", body: "Set a monthly or quarterly retainer once. Each invoice is created and emailed on schedule, with the payment link every time." },
      { title: "Reminders nobody has to remember", body: "On Pro, clients get a reminder the day before the due date, then 3 and 7 days after. They stop when the invoice is paid." },
    ],
    steps: [
      { title: "Add your company details once", body: "Logo, RC number, TIN and bank account. They appear on every invoice from then on." },
      { title: "Create the invoice in a minute", body: "Pick the client, add your services, choose VAT and WHT. Totals are worked out as you type." },
      { title: "Send it and let BizBooks follow up", body: "Email or WhatsApp it. BizBooks tracks the view, sends the reminders and records the payment." },
    ],
    example: {
      title: "Worked example: a ₦1,000,000 consultancy invoice",
      intro: "A VAT-registered agency bills a corporate client for a month's retainer. The client deducts 5% withholding tax on professional fees.",
      rows: [
        { label: "Fee", value: naira(vatInvoice.subtotal) },
        { label: "VAT (7.5%)", value: naira(vatInvoice.vatAmount) },
        { label: "Invoice total", value: naira(vatInvoice.total), strong: true },
        { label: "WHT deducted by the client (5% of the fee)", value: `−${naira(vatInvoice.whtAmount)}` },
        { label: "What the client actually sends", value: naira(vatInvoice.amountDue), strong: true },
      ],
      note: "WHT is worked out on the amount before VAT. The client remits the WHT to the tax authority and gives you a credit note you can use against your own income tax, so BizBooks tracks it as a credit, not a loss.",
    },
    faqs: [
      { q: "Can I invoice clients who deduct withholding tax?", a: "Yes. Choose the WHT rate on the invoice (usually 5% for consultancy and professional fees, 2% for supply contracts, 10% for rent). The invoice shows the total, the WHT they'll deduct and the balance they'll actually send." },
      { q: "Can I still send invoices on WhatsApp?", a: "Yes. Every invoice has a WhatsApp button that opens a ready-written message with the Pay now link, and a plain link you can paste anywhere. Email works too." },
      { q: "What if a client pays by bank transfer?", a: "Your account number is on the invoice with a copy button. When the client taps “I've sent the transfer”, you get an email to check your bank, then confirm it in one tap." },
      { q: "Can I bill in dollars or pounds?", a: "Yes. Invoice in USD, GBP, EUR and other currencies with the exchange rate you set. Reports and VAT convert to naira at the recorded rate." },
      { q: "Is invoicing free?", a: `Yes. The Free plan includes unlimited invoices and quotes. Pro (${naira(PLANS.PRO.monthly)} a month) adds automatic reminders, unlimited recurring invoices and your own branding without the BizBooks footer.` },
      { q: "Can I bring my invoices over from Wave or Zoho Books?", a: "Yes. Import a CSV export and BizBooks brings in your clients, invoices, services and payment history, and spots monthly retainers to set up as recurring invoices." },
    ],
    resources: [
      { label: "VAT and WHT invoice calculator", href: "/tools/vat-wht-calculator" },
      { label: "How to write a professional invoice in Nigeria", href: "/insights/how-to-write-a-professional-invoice-in-nigeria" },
    ],
    close: { headline: "Send your first invoice in the next five minutes.", sub: `Start with ${TRIAL.days} days of Pro, free. No card needed, and the Free plan keeps your invoices free forever after.` },
  },

  {
    slug: "payments",
    group: "Get paid",
    name: "Online payments",
    menu: "Card, transfer and USSD payments on every invoice",
    title: "Accept invoice payments online in Nigeria: card, transfer and USSD",
    description: "Put a Pay now button on every invoice. Clients pay by card, bank transfer or USSD and the money settles straight to your company's bank account. Payments are matched to invoices automatically.",
    eyebrow: "Online payments",
    headline: "Make paying you the easiest thing on your client's desk.",
    sub: "Every invoice gets a Pay now button for card, bank transfer and USSD. The money settles to your company's own bank account, and the invoice marks itself paid. No screenshots, no matching.",
    answer: {
      q: "How do BizBooks online payments work?",
      a: "BizBooks adds a secure Paystack checkout to every invoice. Clients pay by card, transfer or USSD; Paystack settles the money directly to your company's verified bank account; BizBooks confirms the payment with Paystack and marks the invoice paid. BizBooks never holds or moves your money.",
    },
    pains: [
      { title: "“Kindly send your account details.”", body: "A client ready to pay still has to ask, copy, transfer, screenshot and send. Every extra step is a chance to put it off until next week." },
      { title: "Screenshot reconciliation", body: "Someone matches transfer screenshots and bank alerts to invoices by hand, and partial payments make it worse." },
      { title: "Setting up a payment gateway is a project", body: "API keys, webhooks and settlement settings are a developer's job, not a finance manager's." },
    ],
    stakes: "The fewer steps between “this invoice is approved” and “paid”, the sooner the money lands. A one-tap payment link removes the most common excuse for a late payment: it was inconvenient.",
    compare: [
      { without: "Clients ask for your account details", with: "A Pay now button on every invoice, email and WhatsApp message" },
      { without: "Transfers matched to invoices from screenshots", with: "Each payment confirmed with Paystack and recorded against its invoice" },
      { without: "Gateway API keys and webhooks to set up", with: "Add your business account once; it's verified by name in seconds" },
      { without: "Fees worked out at month end", with: "Fees booked as an expense automatically, so your books match your bank" },
    ],
    benefits: [
      { title: "Money straight to your account", body: "With BizBooks Payments, Paystack settles each payment to your company's verified bank account. BizBooks never receives, holds or pays out your money." },
      { title: "Invoices that mark themselves paid", body: "Every payment is checked with Paystack before it's recorded, so the invoice, your cash flow and your reports update on their own." },
      { title: "No keys, no developers", body: "Add your business bank account and BizBooks checks the account name matches your company. Prefer your own Paystack or Flutterwave? Connect it instead." },
      { title: "Fees you can see", body: `${naira(PLATFORM_FEE.amount)} per payment, VAT included, and nothing on payments under ${naira(PLATFORM_FEE.freeBelow)}. Your first payments are fee-free. Paystack's own fee is the same as on your own account.` },
    ],
    steps: [
      { title: "Add your business bank account", body: "BizBooks looks up the account name with your bank and checks it matches your company." },
      { title: "Send invoices as usual", body: "The Pay now button appears on every invoice, email and WhatsApp message automatically." },
      { title: "Get paid and get told", body: "The money settles to your bank on Paystack's schedule, and you get an email the moment a client pays." },
    ],
    example: {
      title: `Worked example: a client pays a ${naira(invoiceAmount)} invoice`,
      intro: "The client pays by card through the Pay now button. Here is what comes off before the money settles to your account.",
      rows: [
        { label: "Invoice paid", value: naira(invoiceAmount) },
        { label: "Paystack's standard fee (1.5% + ₦100, capped at ₦2,000)", value: `−${naira(gatewayFee)}` },
        { label: "BizBooks fee (VAT included)", value: `−${naira(PLATFORM_FEE.amount)}` },
        { label: "Settles to your bank account", value: naira(invoiceAmount - gatewayFee - PLATFORM_FEE.amount), strong: true },
      ],
      note: "Both fees are recorded as a bank charges expense automatically, so your profit and loss matches what reached the bank. Payments under ₦2,500 carry no BizBooks fee, and your first payments are fee-free.",
    },
    faqs: [
      { q: "Does BizBooks hold our money?", a: "No. With BizBooks Payments, Paystack settles each payment straight to your company's bank account and deducts the fees on the way. With your own Paystack or Flutterwave account, the money goes to your gateway balance. Either way, BizBooks never holds or moves client money." },
      { q: "Which bank accounts can receive payments?", a: "Your company's own business account. BizBooks checks the account name with your bank; if it doesn't match your company name, a person reviews it before payments go live, so settlements can't be quietly redirected." },
      { q: "Can clients still pay by bank transfer?", a: "Yes. Your account number stays on every invoice with a copy button. Pay now is an option for clients who'd rather pay by card, transfer or USSD in one step." },
      { q: "Can I use my own Paystack or Flutterwave account instead?", a: "Yes. Connect your own account with its secret key, which BizBooks encrypts and never shows in full again. You then pay your gateway's standard fees and nothing extra to BizBooks." },
      { q: "Do foreign-currency invoices get a Pay now button?", a: "BizBooks Payments takes naira. For USD and other currencies, connect your own Paystack or Flutterwave account if it's enabled for that currency, or take a transfer." },
    ],
    resources: [
      { label: "VAT and WHT invoice calculator", href: "/tools/vat-wht-calculator" },
      { label: "Compare BizBooks with Wave", href: "/compare/wave" },
    ],
    close: { headline: "Put a Pay now button on your next invoice.", sub: `Start free with ${TRIAL.days} days of Pro. Add your business account when you're ready; there's nothing to install.` },
  },

  {
    slug: "quotes",
    group: "Get paid",
    name: "Quotes & deposits",
    menu: "Win projects and collect deposits upfront",
    title: "Quotes and mobilisation deposits for agencies and service companies",
    description: "Send quotes clients accept online, collect the mobilisation deposit in the same step, and turn the quote into the final invoice with the deposit and VAT already handled.",
    eyebrow: "Quotes and deposits",
    headline: "Win the project. Collect the deposit. Start the work.",
    sub: "Send a quote your client can accept online. If you ask for a mobilisation deposit, they pay it straight away, and it's credited on the final invoice automatically, with VAT charged only once.",
    answer: {
      q: "How do quotes and deposits work in BizBooks?",
      a: "You send a quote with an optional deposit (for example 50%). The client accepts it online with their name; BizBooks raises the deposit invoice and takes them straight to pay it. When the work is done, one tap turns the quote into the final invoice with the deposit and its VAT already deducted.",
    },
    pains: [
      { title: "“Approved, but procurement will revert.”", body: "A verbal yes isn't a signed quote, and without one the project can stall for weeks before anyone pays a mobilisation fee." },
      { title: "Starting work unpaid", body: "You buy materials and assign the team before the deposit lands, then chase it alongside the actual work." },
      { title: "The final-invoice maths", body: "Deducting a deposit by hand, without charging VAT twice, is where invoices go wrong and get sent back." },
    ],
    stakes: "A deposit paid at the moment of acceptance turns “we're interested” into a committed client. It protects your cash flow on the projects where you spend the most before you're paid.",
    compare: [
      { without: "PDF quotes approved by email (eventually)", with: "Clients accept online with their name; you're told immediately" },
      { without: "Deposit invoices raised separately, days later", with: "The deposit invoice is raised and payable the moment they accept" },
      { without: "Deposit deducted by hand on the final invoice", with: "Credited automatically, with VAT on the balance only" },
      { without: "No idea how many quotes you win", with: "See what's waiting, what's won and your acceptance rate" },
    ],
    benefits: [
      { title: "Acceptance in one click", body: "Clients open the quote, read the scope and accept it with their name. No printing, signing and scanning." },
      { title: "Deposits paid on the spot", body: "Ask for 30%, 50% or 70% upfront. The client goes straight from “Accept” to paying the deposit." },
      { title: "Final invoice without the maths", body: "Turn the accepted quote into the invoice in one tap. The deposit is credited and VAT is charged only on the balance." },
      { title: "A clear view of your pipeline", body: "Quotes sent, accepted and waiting, so you know which clients to call this week." },
    ],
    steps: [
      { title: "Send the quote", body: "Same editor as invoices: services, VAT, a validity date and the deposit percentage." },
      { title: "The client accepts and pays the deposit", body: "They accept online and are taken straight to the deposit invoice's Pay now page." },
      { title: "Invoice the balance when you deliver", body: "One tap creates the final invoice with the deposit already credited." },
    ],
    example: {
      title: "Worked example: a ₦3,000,000 website project with a 50% deposit",
      intro: "A VAT-registered agency quotes ₦3,000,000 plus VAT and asks for half upfront.",
      rows: [
        { label: "Deposit invoice: 50% of the fee", value: naira(deposit.subtotal) },
        { label: "VAT on the deposit (7.5%)", value: naira(deposit.vatAmount) },
        { label: "Client pays on acceptance", value: naira(deposit.total), strong: true },
        { label: "Final invoice: fee less deposit", value: naira(balance.subtotal) },
        { label: "VAT on the balance (7.5%)", value: naira(balance.vatAmount) },
        { label: "Client pays on delivery", value: naira(balance.total), strong: true },
      ],
      note: `Across both invoices the client pays ${naira(deposit.total + balance.total)}: the ₦3,000,000 fee plus VAT of ${naira(deposit.vatAmount + balance.vatAmount)}, charged once.`,
    },
    faqs: [
      { q: "What happens to VAT on the deposit?", a: "The deposit invoice carries VAT on the deposit amount. The final invoice credits the deposit and charges VAT only on the balance, so VAT is never charged twice." },
      { q: "What if the client wants changes before accepting?", a: "Edit the quote and the same link shows the new version. Accepted quotes are locked to what the client agreed." },
      { q: "Do clients need an account to accept?", a: "No. They open the link, read the quote and accept with their name. Nothing to sign up for." },
      { q: "Is this on the Free plan?", a: `Quotes and online acceptance are free. Asking for a deposit on acceptance is part of Pro (${naira(PLANS.PRO.monthly)} a month, or ${naira(PLANS.PRO.yearly)} a year), included in your ${TRIAL.days}-day free trial.` },
    ],
    resources: [
      { label: "VAT calculator (7.5%)", href: "/tools/vat-calculator" },
      { label: "VAT guide for service companies", href: "/insights/vat-in-nigeria-for-service-companies" },
    ],
    close: { headline: "Turn your next “yes” into a paid deposit.", sub: `Quotes with online acceptance and deposits are included in your ${TRIAL.days}-day Pro trial. No card needed.` },
  },

  {
    slug: "accounting",
    group: "Stay organized & tax-ready",
    name: "Bookkeeping & reports",
    menu: "Know where the company stands, every day",
    title: "Bookkeeping and financial reports for Nigerian companies",
    description: "Profit and loss, cash flow, VAT and aged receivables built from your invoices, expenses and payroll. Shareable statements and accountant-ready exports. Free to start.",
    eyebrow: "Bookkeeping and reports",
    headline: "Know where the company stands without waiting for month end.",
    sub: "Every invoice, payment, expense, bill and pay run lands in one set of books. Profit, cash flow and who owes you what are always current, and every report is a statement you can send to your bank, investor or accountant.",
    answer: {
      q: "What reports does BizBooks produce?",
      a: "BizBooks produces a profit and loss statement (accrual or cash basis), a cash flow statement, a VAT report, aged receivables and payables, income by client, purchases by supplier and a payroll summary. Each lists the transactions behind its totals and prints or saves as a PDF with your company's details.",
    },
    pains: [
      { title: "“How much did we actually make?”", body: "The bank balance says one thing, the spreadsheet another, and the real answer waits for the accountant at year end." },
      { title: "Records in five places", body: "Invoices in Word, expenses in a notebook, salaries in the bank app and receipts in a drawer. Pulling them together takes days." },
      { title: "The bank or investor wants statements", body: "A loan application or investor update needs a proper P&L and cash flow, and it needs them this week." },
    ],
    stakes: "Decisions made on the bank balance alone go wrong: money that looks spare is owed in VAT, salaries or a supplier bill. Current books are how you know what you can actually spend.",
    compare: [
      { without: "Profit worked out once a year", with: "Profit and loss for any month, quarter or year, on demand" },
      { without: "Spreadsheets that disagree with the bank", with: "One set of books fed by your invoices, payments, expenses and payroll" },
      { without: "Statements assembled for every request", with: "Shareable statements with every transaction listed, ready as a PDF" },
      { without: "A folder of screenshots for the accountant", with: "One CSV with every transaction for the period" },
    ],
    benefits: [
      { title: "A dashboard that answers the real questions", body: "Cash flow, profit, overdue invoices, bills you owe and what's due in the next 30 days, on one screen." },
      { title: "Accrual or cash, your choice", body: "See profit the way your accountant does (when you invoice) or the way your bank does (when money moves). Switch with one tap." },
      { title: "Statements you can send", body: "Profit and loss and cash flow statements with your RC number and TIN, every transaction listed and totals that add up, ready to print or save as a PDF." },
      { title: "Your accountant's favourite client", body: "Send one CSV with every payment and expense for the month or year, VAT split out, instead of a box of receipts." },
    ],
    steps: [
      { title: "Work as you already do", body: "Send invoices, record expenses with a photo of the receipt, run payroll." },
      { title: "BizBooks keeps the books", body: "Each one is recorded in the right place, in naira, with VAT separated." },
      { title: "Open any report, any time", body: "Choose the period and basis, then print, save as PDF or export." },
    ],
    example: {
      title: "Worked example: one month, two answers to “did we make money?”",
      intro: "In October a company that isn't VAT registered invoices ₦2,000,000, but only ₦1,200,000 of it is paid by month end. It pays ₦700,000 of expenses.",
      rows: [
        { label: "Accrual profit (what you earned)", value: naira(2_000_000 - 700_000), strong: true },
        { label: "Cash profit (what reached the bank)", value: naira(1_200_000 - 700_000), strong: true },
        { label: "Still owed to you", value: naira(800_000) },
      ],
      note: "Both are right; they answer different questions. BizBooks shows either with one tap, and the aged receivables report shows exactly who owes the difference.",
    },
    faqs: [
      { q: "Do I need to know accounting?", a: "No. You record what happened (you sent an invoice, paid a bill, ran payroll) and BizBooks puts it in the right place. Reports are written in plain English." },
      { q: "Can I share reports with my bank or investors?", a: "Yes. Profit and loss and cash flow are full statements with your company's details and every transaction listed. Print them or save them as a PDF to send." },
      { q: "Can my accountant work with it?", a: "Yes. Every report prints to PDF, and Pro exports every transaction as a CSV with VAT split out, ready for their own tools." },
      { q: "Is there a balance sheet?", a: "Not yet. A full balance sheet needs bank feeds and a complete ledger, and both are on the way. Until then, the profit and loss, cash flow and aging reports cover the day-to-day." },
      { q: "Can I bring in my history from Wave or Zoho Books?", a: "Yes. Import your invoices, clients and payments from a CSV export, so your reports include last year as well." },
    ],
    resources: [
      { label: "Company income tax calculator 2026", href: "/tools/company-income-tax-calculator" },
      { label: "Nigeria tax calendar 2026", href: "/insights/nigeria-tax-calendar-2026" },
    ],
    close: { headline: "See this month's profit before your next meeting.", sub: `Start free with ${TRIAL.days} days of Pro. Import last year from Wave or Zoho and your reports are ready the same day.` },
  },

  {
    slug: "expenses",
    group: "Stay organized & tax-ready",
    name: "Expenses, bills & receipts",
    menu: "Track spending and never miss a bill",
    title: "Expense tracking, supplier bills and receipts for Nigerian companies",
    description: "Record expenses with a photo of the receipt, keep supplier bills until they're paid, set rent and subscriptions to record themselves, and claim back input VAT.",
    eyebrow: "Expenses, bills and receipts",
    headline: "Know exactly where the money goes, and what's due next.",
    sub: "Record an expense in seconds with a photo of the receipt. Keep supplier bills until they're paid. Set rent, internet and software to record themselves. Input VAT is tracked so you don't overpay.",
    answer: {
      q: "How does BizBooks handle expenses and bills?",
      a: "BizBooks records each expense with its category, supplier, VAT and a photo of the receipt. Bills you'll pay later are kept with their due date until you mark them paid, and fixed costs like rent repeat automatically. Input VAT on expenses is offset against the VAT you charge.",
    },
    pains: [
      { title: "The receipt drawer", body: "Receipts fade, get lost or turn up in March, and the tax office or your accountant still wants them." },
      { title: "Bills that slip", body: "A supplier invoice sits in someone's email until the supplier calls, and now it's late." },
      { title: "VAT you paid and never claimed", body: "VAT on supplier invoices can reduce the VAT you remit, but only if someone records it." },
    ],
    stakes: "Unrecorded expenses make profit look higher than it is, which means more tax and worse decisions. Unclaimed input VAT is money handed over twice.",
    compare: [
      { without: "Paper receipts in a drawer", with: "A photo stored with each expense, ready when it's asked for" },
      { without: "Supplier bills in someone's inbox", with: "“Bills you owe” with due dates on your dashboard" },
      { without: "Rent and subscriptions typed in every month", with: "Recurring expenses that record themselves on their date" },
      { without: "Input VAT forgotten", with: "VAT on purchases tracked and offset in your VAT report" },
    ],
    benefits: [
      { title: "Expenses in seconds", body: "Amount, category, supplier and a photo of the receipt from your phone. That's it." },
      { title: "Bills on the radar", body: "Record a supplier invoice as not paid yet. It stays on your dashboard with its due date until you mark it paid in one tap." },
      { title: "Fixed costs on autopilot", body: "Office rent, software, internet and diesel: enter them once and they're logged on their due date." },
      { title: "Input VAT that counts", body: "Note the VAT on supplier invoices and BizBooks offsets it against the VAT you charge in your VAT report." },
    ],
    steps: [
      { title: "Snap and save", body: "Photograph the receipt, pick the category, done." },
      { title: "Keep bills until they're paid", body: "Record a supplier invoice with its due date; it waits on your dashboard." },
      { title: "See it in your reports", body: "Expenses flow into profit, cash flow and the VAT report automatically." },
    ],
    example: {
      title: "Worked example: claiming input VAT",
      intro: "In a month a VAT-registered company charges ₦150,000 VAT on its invoices and pays ₦20,000 VAT on software and equipment it bought.",
      rows: [
        { label: "VAT charged to clients (output VAT)", value: naira(150_000) },
        { label: "VAT paid on purchases (input VAT)", value: `−${naira(20_000)}` },
        { label: "VAT to remit by the 21st", value: naira(130_000), strong: true },
      ],
      note: "Without the purchase VAT recorded, the company would remit ₦150,000. BizBooks keeps the input VAT with each expense and shows the net figure in the VAT report.",
    },
    faqs: [
      { q: "What's the difference between an expense and a bill?", a: "An expense is already paid. A bill is something you owe and will pay later. Bills show in “Bills you owe” with their due date until you mark them paid, and count in cash flow on the day you pay." },
      { q: "Do I enter salaries as expenses?", a: "No. Payroll records salaries and employer pension for you each month when you mark a pay run as paid." },
      { q: "How many recurring expenses can I set up?", a: "Three on the Free plan, unlimited on Pro." },
      { q: "Are receipt photos stored safely?", a: "Yes. Each photo is compressed and stored with its expense in your account, visible only to people signed in to your business." },
    ],
    resources: [
      { label: "VAT calculator (7.5%)", href: "/tools/vat-calculator" },
      { label: "VAT guide for service companies", href: "/insights/vat-in-nigeria-for-service-companies" },
    ],
    close: { headline: "Clear the receipt drawer this week.", sub: `Start free. Expenses, bills and receipt photos are on every plan, with ${TRIAL.days} days of Pro to try the rest.` },
  },

  {
    slug: "taxes",
    group: "Stay organized & tax-ready",
    name: "Tax tracking",
    menu: "VAT, PAYE, WHT and pension deadlines",
    title: "Tax tracking for Nigerian companies: VAT, PAYE, WHT and pension (2026 rules)",
    description: "See the VAT, PAYE, pension and withholding tax your company owes and when each is due, worked out from your invoices, expenses and payroll under the 2026 rules.",
    eyebrow: "Tax tracking under the 2026 rules",
    headline: "Never be caught out by a tax deadline again.",
    sub: "BizBooks works out the VAT, PAYE, pension and withholding tax your company owes from your own invoices, bills and payroll, shows when each is due, and tells you how much to keep aside.",
    answer: {
      q: "Which Nigerian taxes does BizBooks track?",
      a: "BizBooks tracks VAT (7.5%, due by the 21st of the next month), PAYE (due by the 10th), pension contributions (within 7 working days of pay day) and withholding tax deducted from contractors (due by the 21st). Amounts come from your invoices, expenses and payroll, under the Nigeria Tax Act 2025 rules in force from January 2026.",
    },
    pains: [
      { title: "Four taxes, four deadlines", body: "VAT, PAYE, pension and WHT each have their own date and their own authority, and a busy month is when one gets missed." },
      { title: "“How much do we owe?”", body: "Working out VAT and PAYE means pulling invoices, expenses and payroll together every month." },
      { title: "The 2026 rules changed", body: "New PAYE bands, rent relief and the small-company exemption all came in with the Nigeria Tax Act 2025." },
    ],
    stakes: "Late filing and late payment attract penalties and interest, and spending money that's owed in VAT or PAYE makes the next deadline harder. Knowing the number early is the cheapest way to stay compliant.",
    compare: [
      { without: "Deadlines kept in someone's head", with: "A tax calendar that fills itself, with the amount for each" },
      { without: "VAT added up from invoices by hand", with: "Output VAT less input VAT, worked out from your records" },
      { without: "PAYE from an old spreadsheet", with: "PAYE under the 2026 bands, per person, every pay run" },
      { without: "WHT credits forgotten", with: "WHT clients deduct from you tracked as a credit" },
    ],
    benefits: [
      { title: "A tax calendar that fills itself", body: "VAT by the 21st, PAYE by the 10th, pension within 7 working days of pay day and WHT by the 21st, each with its amount." },
      { title: "Updated for 2026", body: "PAYE uses the Nigeria Tax Act 2025 bands, with the first ₦800,000 a year tax-free, rent relief of 20% of rent up to ₦500,000, and pension relief." },
      { title: "WHT both ways", body: "Track the withholding tax clients deduct from you (a credit against your income tax) and the WHT you deduct from contractors." },
      { title: "The small-company check", body: "See whether turnover up to ₦100 million and fixed assets up to ₦250 million keep you at 0% company income tax, and what changes for professional services." },
    ],
    steps: [
      { title: "Invoice, spend and pay staff as usual", body: "Every transaction already carries its VAT, WHT and PAYE." },
      { title: "Check the tax page", body: "See what's due, by when, and how much to set aside." },
      { title: "File, pay and mark it done", body: "Use the figures to file through the official channels, then mark each one remitted." },
    ],
    example: {
      title: "Worked example: what one month's taxes look like",
      intro: "A VAT-registered agency invoices ₦2,000,000 plus VAT in October and pays ₦20,000 VAT on software. It has five staff on ₦500,000 a month and one contractor on ₦300,000.",
      rows: [
        { label: "VAT: output ₦150,000 less input ₦20,000, due 21 November", value: naira(130_000) },
        { label: "PAYE for five staff, due 10 November", value: naira(pay.paye * 5) },
        { label: "Pension, 8% staff + 10% company, due 7 working days after pay day", value: naira((pay.pensionEmployee + pay.pensionEmployer) * 5) },
        { label: "WHT deducted from the contractor (5%), due 21 November", value: naira(contractorWht) },
        { label: "Total to set aside", value: naira(130_000 + pay.paye * 5 + (pay.pensionEmployee + pay.pensionEmployer) * 5 + contractorWht), strong: true },
      ],
      note: "The tax page shows each line with its exact amount from your own records, and turns red when a deadline is close. BizBooks doesn't file for you; it gives you the figures to file with.",
    },
    faqs: [
      { q: "Does BizBooks file my taxes?", a: "No. It works out the amounts and deadlines and gives you the reports. You or your accountant file and pay through the tax authorities' own channels, then mark each one as remitted." },
      { q: "Is BizBooks updated for the Nigeria Tax Act 2025?", a: "Yes. PAYE uses the bands in force from 1 January 2026 (0% on the first ₦800,000, then 15%, 18%, 21%, 23% and 25%), with rent relief and pension relief. The small-company check uses the ₦100 million turnover and ₦250 million fixed-asset limits." },
      { q: "How accurate are the figures?", a: "They follow the published rules and your own records, so they're as complete as what you've recorded. Treat them as the numbers to plan with, and have your accountant confirm before you file." },
      { q: "Do small companies still pay VAT?", a: "Small-company status affects company income tax, not VAT. If you're VAT registered, you charge 7.5% and file monthly. BizBooks shows both." },
      { q: "Does it track withholding tax deducted by my clients?", a: "Yes. WHT your clients deduct is shown on each invoice and in your reports as a credit you can use against your own income tax." },
    ],
    resources: [
      { label: "Nigeria tax calendar 2026", href: "/insights/nigeria-tax-calendar-2026" },
      { label: "Company income tax calculator 2026", href: "/tools/company-income-tax-calculator" },
      { label: "PAYE calculator 2026", href: "/tools/paye-calculator" },
    ],
    close: { headline: "Know this month's tax bill before it's due.", sub: `Start free with ${TRIAL.days} days of Pro. Your tax calendar fills itself as soon as you send an invoice.` },
  },

  {
    slug: "payroll",
    group: "Pay your team",
    name: "Payroll",
    menu: "Pay staff and contractors with PAYE worked out",
    title: "Payroll software for Nigerian companies: PAYE, pension and payslips (2026)",
    description: "Run payroll under the 2026 PAYE rules: PAYE, pension, NHF and contractor WHT worked out per person, payslips, a bank upload file, and everything recorded in your books.",
    eyebrow: "Payroll under the 2026 PAYE rules",
    headline: "Payroll in minutes, with the tax already worked out.",
    sub: "Add your staff and contractors once. Every month BizBooks works out PAYE, pension, NHF and withholding tax, produces payslips and a bank upload file, and records it all in your books.",
    answer: {
      q: "What does BizBooks payroll do?",
      a: "BizBooks payroll calculates each person's PAYE under the Nigeria Tax Act 2025 bands, 8% employee and 10% employer pension, optional NHF and contractor withholding tax. It produces payslips and a bank bulk-transfer file, adds the deadlines to your tax calendar and records salaries in your books.",
    },
    pains: [
      { title: "The payroll spreadsheet nobody trusts", body: "Formulas copied from last year, bands that changed in 2026, and one person who knows how it works." },
      { title: "“Please send my payslip.”", body: "Staff need payslips for loans, visas and rent, and making them one by one takes an afternoon." },
      { title: "Remittances that get missed", body: "PAYE goes to the state, pension to each employee's PFA, WHT to the tax authority, each on its own deadline." },
    ],
    stakes: "Under-deducting PAYE leaves the company owing the difference; over-deducting costs your staff money they notice. With the 2026 bands, last year's spreadsheet is wrong for almost everyone.",
    compare: [
      { without: "PAYE from last year's spreadsheet", with: "PAYE under the 2026 bands, worked out per person" },
      { without: "Payslips made one by one", with: "A payslip link for everyone, emailed if you like" },
      { without: "Bank transfers typed in individually", with: "A bulk-transfer file to upload to your bank" },
      { without: "Salaries entered into the books separately", with: "Salaries and employer pension recorded automatically" },
    ],
    benefits: [
      { title: "PAYE under the 2026 rules", body: "The Nigeria Tax Act 2025 bands, the ₦800,000 tax-free threshold, rent relief and pension relief, calculated per person every month." },
      { title: "Staff and contractors on one run", body: "Salaried staff get PAYE and pension. Contractors get withholding tax. Both on the same pay run." },
      { title: "Payslips and a bank file", body: "A payslip for every person, emailed on Pro, and a CSV for your bank's bulk transfer." },
      { title: "Straight into your books", body: "Mark the run paid and salaries and employer pension appear in your expenses, profit and tax calendar." },
    ],
    steps: [
      { title: "Add your team once", body: "Name, monthly gross, pension and rent details, and bank account for each person." },
      { title: "Create the month's pay run", body: "PAYE, pension, NHF and WHT are worked out for everyone in seconds." },
      { title: "Pay from your bank and mark it paid", body: "Upload the bank file, send payslips, and the books and tax calendar update." },
    ],
    example: {
      title: "Worked example: ₦500,000 a month under the 2026 rules",
      intro: "An employee on ₦500,000 gross a month, with pension, who pays ₦1,200,000 a year in rent. Calculated by BizBooks' own payroll engine.",
      rows: [
        { label: "Gross pay", value: naira(pay.gross) },
        { label: "Pension (8% employee)", value: `−${naira(pay.pensionEmployee)}` },
        { label: "Rent relief (20% of rent, a month)", value: naira(pay.rentRelief) },
        { label: "PAYE", value: `−${naira(pay.paye)}` },
        { label: "Take-home pay", value: naira(pay.net), strong: true },
        { label: "Employer pension (10%, paid by the company)", value: naira(pay.pensionEmployer) },
      ],
      note: "Rent relief and pension reduce taxable income; they aren't deductions from pay. Try your own figures with the free PAYE calculator.",
    },
    faqs: [
      { q: "Does BizBooks pay my staff?", a: "No. You pay from your own bank, usually by uploading the bank file BizBooks gives you. Your money stays under your control." },
      { q: "Does it remit PAYE and pension?", a: "It tells you exactly how much to remit and by when, and adds each deadline to your tax calendar. You remit through your state internal revenue service and each employee's PFA." },
      { q: "How many people can I pay for free?", a: "Up to 3 on the Free plan. Pro covers your whole team and emails payslips." },
      { q: "Is it updated for the Nigeria Tax Act 2025?", a: "Yes. From January 2026: 0% on the first ₦800,000 of annual taxable income, then 15%, 18%, 21%, 23% and 25%, with rent relief of 20% of annual rent up to ₦500,000." },
      { q: "Can I pay contractors too?", a: "Yes. Contractors are paid on the same run with withholding tax (usually 5% or 10%) deducted instead of PAYE and pension." },
    ],
    resources: [
      { label: "PAYE calculator 2026", href: "/tools/paye-calculator" },
      { label: "Net to gross salary calculator", href: "/tools/net-to-gross-salary-calculator" },
      { label: "Cost of an employee calculator", href: "/tools/employer-cost-calculator" },
    ],
    close: { headline: "Run this month's payroll in minutes.", sub: `Payroll for up to 3 people is free. Start with ${TRIAL.days} days of Pro to run it for your whole team.` },
  },
];

export const SOLUTION_GROUPS = ["Stay organized & tax-ready", "Get paid", "Pay your team"] as const;

/** Shown on every solutions page and in its structured data. */
export const SOLUTIONS_UPDATED = "2026-10-02";
