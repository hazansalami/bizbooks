/*
  BizBooks vs Wave vs Zoho Books, for Nigerian companies. One source of truth for the homepage table
  and the /compare pages. Keep it fair: competitors' strengths are stated plainly, and every claim about
  them is from their own pages (sources below). Re-check when they change plans.
*/

export type Cell = boolean | string;
export type Rival = "zoho" | "wave";

export const RIVALS: Record<Rival, { name: string; label: string }> = {
  zoho: { name: "Zoho Books", label: "Zoho Books (Nigeria edition)" },
  wave: { name: "Wave", label: "Wave (in Nigeria)" },
};

export const COMPARE_ROWS: { label: string; home?: boolean; bizbooks: Cell; zoho: Cell; wave: Cell }[] = [
  { label: "Send invoices by email with automatic reminders", home: true, bizbooks: true, zoho: true, wave: "Not outside the US and Canada" },
  { label: "Clients pay online with Paystack or Flutterwave", home: true, bizbooks: "Built in, into your own account", zoho: "Through add-on apps", wave: false },
  { label: "Payroll with 2026 PAYE, pension and NHF, payslips and a bank upload file", home: true, bizbooks: true, zoho: "Zoho Payroll isn't available in Nigeria", wave: "US and Canada only" },
  { label: "Nigerian VAT and withholding tax on invoices", home: true, bizbooks: true, zoho: true, wave: "VAT set up by hand; no WHT" },
  { label: "Tax calendar for VAT, WHT, PAYE and pension deadlines", home: true, bizbooks: true, zoho: "VAT and WHT reports", wave: false },
  { label: "Retainers: recurring invoices and recurring expenses", home: true, bizbooks: true, zoho: true, wave: "Can't send automatically" },
  { label: "Free plan", home: true, bizbooks: "Unlimited invoices, payroll for 3 people", zoho: "1 user, 1,000 invoices a year, no payroll", wave: "Free, but can't send invoices" },
  { label: "Done-for-you bookkeeping, tax and payroll", home: true, bizbooks: "BizBooks Advisors", zoho: "Through partner firms", wave: "Not in Nigeria" },
  { label: "Bring your history across from Wave or Zoho Books", bizbooks: "Clients, invoices, services and retainers, read automatically", zoho: "CSV import with manual field mapping", wave: "Customer lists by CSV" },
  { label: "NRS e-invoicing (Merchant-Buyer Solution)", bizbooks: "On our roadmap", zoho: "Professional plan and up", wave: false },
  { label: "Inventory, projects and timesheets", bizbooks: false, zoho: "Professional plan and up", wave: false },
];

export const COMPARE_SOURCES = [
  { label: "Zoho Books Nigeria pricing", href: "https://www.zoho.com/en-ng/books/pricing/" },
  { label: "Zoho Books Nigeria edition launch (Technext, Sept 2026)", href: "https://technext24.com/news/zoho-books-for-vat-e-invoicing-nigeria/" },
  { label: "Zoho: Do you have payroll in Zoho Books?", href: "https://www.zoho.com/books/kb/general/payroll.html" },
  { label: "Paystack for Zoho Books (Zoho Marketplace)", href: "https://marketplace.zoho.com/app/books/paystack-for-zoho-books" },
  { label: "Wave pricing (Payments and Payroll availability)", href: "https://www.waveapps.com/pricing" },
];

export type ComparePage = {
  slug: string; rival: Rival; title: string; description: string; h1: string; answer: string;
  wins: { title: string; body: string }[];
  theyWin: string[];
  switchSteps: string[];
  faqs: { q: string; a: string }[];
};

export const COMPARE_PAGES: ComparePage[] = [
  {
    slug: "zoho-books",
    rival: "zoho",
    title: "BizBooks vs Zoho Books for Nigerian companies (2026)",
    description: "An honest comparison of BizBooks and Zoho Books' Nigeria edition: payroll and PAYE, Paystack and Flutterwave, VAT and WHT, e-invoicing, pricing and switching.",
    h1: "BizBooks vs Zoho Books",
    answer: "Zoho Books' Nigeria edition is a capable general accounting suite with VAT, WHT and NRS e-invoicing on its higher plans. BizBooks is built for Nigerian service companies that also run a payroll: it includes 2026 PAYE, pension and NHF payroll (Zoho Payroll isn't available in Nigeria), takes payments through your own Paystack or Flutterwave account without add-ons, tracks every tax deadline, and offers done-for-you bookkeeping.",
    wins: [
      { title: "Payroll is included, and it's Nigerian", body: "PAYE under the 2026 bands, rent relief, pension, NHF, payslips and a bank upload file, all posted to your books. Zoho Payroll isn't offered in Nigeria, so Zoho Books users run payroll elsewhere and journal it in." },
      { title: "Paystack and Flutterwave without add-ons", body: "Connect your own Paystack or Flutterwave keys and every invoice gets a Pay now button. Payments are confirmed and matched automatically. In Zoho Books, Paystack comes through a marketplace app." },
      { title: "Every Nigerian deadline in one calendar", body: "PAYE by the 10th, VAT and WHT by the 21st, pension within 7 working days of payday, plus company income tax and the development levy worked out from your books." },
      { title: "Made for owners, with accountants on call", body: "An overview of cash, profit and who owes you, in plain words. When you'd rather hand it over, BizBooks Advisors do your bookkeeping, tax filing and payroll from the same records." },
    ],
    theyWin: [
      "NRS e-invoicing through the Merchant-Buyer Solution is live on Zoho's Professional plan and up. It's on the BizBooks roadmap.",
      "Inventory, projects, timesheets and a large app ecosystem, if you sell stock or bill by the hour across big teams.",
      "Lower entry price: Zoho's Standard plan starts at ₦4,320 a month, without payroll.",
    ],
    switchSteps: [
      "In Zoho Books, go to Sales → Invoices → Export Invoices and choose CSV with all fields.",
      "Export Customers, and Recurring Invoices if you have retainers, the same way.",
      "In BizBooks, open Settings → Import and drop in the files. Check the preview, then import. Your invoice numbers, services, VAT, balances and retainers come across.",
    ],
    faqs: [
      { q: "Is BizBooks cheaper than Zoho Books?", a: "Zoho's paid plans start lower (₦4,320 a month for Standard). BizBooks Pro is ₦12,500 a month but includes Nigerian payroll for your whole team, which Zoho Books doesn't offer in Nigeria. Both have a free plan; BizBooks' free plan has unlimited invoices and payroll for up to 3 people." },
      { q: "Does Zoho Books do payroll in Nigeria?", a: "No. Zoho Payroll is available in countries such as India, the UAE, Saudi Arabia and the US, but not Nigeria. BizBooks includes payroll with 2026 PAYE, pension, NHF, payslips and a bank upload file." },
      { q: "Can I move from Zoho Books to BizBooks?", a: "Yes. Export invoices, customers and recurring invoices from Zoho Books as CSV and import them in BizBooks. Line items, descriptions, VAT, due dates and balances come across, and duplicates are skipped, so it's safe to import more than once." },
      { q: "Does BizBooks support NRS e-invoicing?", a: "Not yet. BizBooks already issues sequential invoice numbers, records client Tax IDs and shows VAT separately, and direct Merchant-Buyer Solution connection is on the roadmap. Zoho Books offers MBS submission on its Professional plan and above." },
    ],
  },
  {
    slug: "wave",
    rival: "wave",
    title: "BizBooks vs Wave for Nigerian companies (2026)",
    description: "Wave no longer sends invoices outside the US and Canada. How BizBooks compares with Wave for Nigerian companies, and how to move your clients, invoices and retainers across.",
    h1: "BizBooks vs Wave",
    answer: "Wave still works in Nigeria for bookkeeping, but it no longer sends invoices or reminders outside the US and Canada, and its payments and payroll are US and Canada only. BizBooks keeps Wave's simple approach and adds what Nigerian companies need: invoices and reminders that send, Paystack and Flutterwave payments, 2026 PAYE payroll and a Nigerian tax calendar.",
    wins: [
      { title: "Invoices and reminders that actually send", body: "Email or WhatsApp an invoice in a minute, with automatic reminders before and after the due date. No downloading PDFs and emailing them yourself." },
      { title: "Payments through Nigerian gateways", body: "Your own Paystack or Flutterwave account, so clients pay by card, transfer or USSD and the invoice is marked paid automatically." },
      { title: "Payroll and PAYE for Nigeria", body: "2026 PAYE bands, pension, NHF, payslips and a bank schedule. Wave Payroll is for US and Canadian businesses." },
      { title: "The same simple overview", body: "Cash flow, profit and loss, and who owes what, on one screen, like Wave, plus VAT, WHT and PAYE deadlines." },
    ],
    theyWin: [
      "Wave is free for bookkeeping and has years of polish in its double-entry accounting and bank connections for North American banks.",
    ],
    switchSteps: [
      "In Wave, go to Reports → Account Transactions, choose All time and Accrual, and export CSV. Or use Settings → Data Export for Accounting and Sales.",
      "Export your customer list as CSV for emails and phone numbers.",
      "In BizBooks, open Settings → Import and drop in the files. We rebuild each invoice with its services and VAT, spot your retainers and set them up as recurring invoices.",
    ],
    faqs: [
      { q: "Why can't I send invoices from Wave in Nigeria?", a: "Wave told users outside the US and Canada that sending invoices and reminders from Wave is no longer available. You can still create invoices and keep books, but delivery and reminders are manual." },
      { q: "Can I import my Wave invoices into BizBooks?", a: "Yes. Upload Wave's Account Transactions report or its data export as CSV. BizBooks rebuilds each invoice with client, number, date, services and VAT, and spots monthly retainers so you can keep them running." },
      { q: "Is BizBooks free like Wave?", a: "Yes, BizBooks has a free plan with unlimited invoices, online payments, expenses, tax tracking and payroll for up to 3 people. Pro adds automation and payroll for your whole team." },
    ],
  },
];
