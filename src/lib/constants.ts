export const APP_NAME = "BizBooks";
export const APP_TAGLINE = "Your company's finances, in one clear view";

/*
  Plans. PRICES ARE PLACEHOLDERS: confirm before launch.
  Free has to be genuinely useful (that's how Wave won); Pro sells automation, payroll at scale and polish.
*/
export const PLANS = {
  FREE: {
    name: "Free",
    monthly: 0,
    blurb: "Books, invoicing and tax tracking for a growing company.",
    features: [
      "Unlimited invoices, quotes and receipts",
      "Online payments through your own Paystack or Flutterwave",
      "Expenses with receipt photos, and up to 3 recurring expenses",
      "Payroll for up to 3 people, with PAYE and pension worked out",
      "Profit, cash flow and tax dashboard",
      "Up to 2 recurring invoices",
    ],
  },
  PRO: {
    name: "Pro",
    monthly: 12500,
    yearly: 125000,
    blurb: "For companies with retainers, a payroll and an accountant to keep happy.",
    features: [
      "Everything in Free",
      "Unlimited recurring invoices and recurring expenses",
      "Payroll for your whole team, with emailed payslips",
      "Quotes clients accept online, with deposits",
      "Automatic payment reminders before and after the due date",
      "Your logo and colours, no BizBooks footer",
      "Accountant-ready CSV exports",
    ],
  },
} as const;

export const FREE_RECURRING_LIMIT = 2;
/** Invoice emails a business can send from the Email dialog in 24 hours (anti-spam). */
export const EMAIL_CAP = { daily: 200, newAccount: 30 } as const;
export const FREE_RECURRING_EXPENSE_LIMIT = 3;
export const FREE_PAYROLL_LIMIT = 3;
export const RENEWAL_GRACE_DAYS = 5;
export const MAX_PAUSE_MONTHS = 3;
export const SAVE_OFFER_DISCOUNT = 30;
export const SAVE_OFFER_MONTHS = 3;

/*
  Tax figures. Last reviewed September 2026 against published summaries of the Nigeria Tax Act 2025
  and Nigeria Tax Administration Act 2025. Sources disagree on some thresholds (small company: ₦50m vs
  ₦100m), so every screen labels these as estimates and tells the owner to confirm with a tax adviser.
  Update here only.
*/
export const TAX = {
  vatRate: 7.5,
  smallCompanyTurnover: 100_000_000,
  smallCompanyFixedAssets: 250_000_000,
  standardCitRate: 30,
  // Deduction of Tax at Source (Withholding) Regulations 2024, resident rates.
  whtRates: [
    { label: "None", rate: 0 },
    { label: "2% (supply of goods, construction)", rate: 2 },
    { label: "5% (consultancy, professional, technical, management fees, commission)", rate: 5 },
    { label: "10% (rent, interest, dividends; non-resident professional fees)", rate: 10 },
  ],
  // Personal income tax (PAYE) bands from 1 January 2026: [upper limit of band, rate].
  payeBands: [
    [800_000, 0],
    [3_000_000, 15],
    [12_000_000, 18],
    [25_000_000, 21],
    [50_000_000, 23],
    [Infinity, 25],
  ] as [number, number][],
  rentReliefRate: 20,
  rentReliefCap: 500_000,
  pensionEmployee: 8,
  pensionEmployer: 10,
  nhf: 2.5,
  nsitf: 1,
  itf: 1,
  reviewedOn: "September 2026",
};

/** Usual filing deadlines, as day of the following month. Shown as reminders, not legal advice. */
export const TAX_DEADLINES = {
  payeDay: 10,
  vatDay: 21,
  whtDay: 21,
  pensionWorkingDays: 7,
};

export const ENTITY_TYPES: Record<string, string> = {
  LTD: "Limited company (Ltd)",
  BN: "Business name (BN)",
  PARTNERSHIP: "Partnership",
  SOLE: "Freelancer / sole trader",
  NGO: "Non-profit / NGO",
};

export const TEAM_SIZES = ["Just me", "2–10", "11–50", "51–200", "200+"];

export const INDUSTRIES = [
  "Digital & creative agency", "Software & IT services", "Consulting & advisory", "Marketing, media & PR",
  "Legal services", "Accounting & finance", "Engineering & construction", "Logistics & supply chain",
  "Real estate & facility management", "Education & training", "Healthcare", "Events & hospitality",
  "Manufacturing & distribution", "Other",
];

/** Industries that usually count as "professional services" for the small-company exemption. */
export const PROFESSIONAL_INDUSTRIES = ["Consulting & advisory", "Legal services", "Accounting & finance", "Engineering & construction"];

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta",
  "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers",
  "Sokoto", "Taraba", "Yobe", "Zamfara",
];

export const BANKS = [
  "Access Bank", "Citibank", "Ecobank", "Fidelity Bank", "First Bank", "FCMB", "Globus Bank", "GTBank",
  "Heritage Bank", "Jaiz Bank", "Keystone Bank", "Kuda", "Lotus Bank", "Moniepoint", "OPay", "PalmPay",
  "Parallex Bank", "Polaris Bank", "Providus Bank", "Stanbic IBTC", "Standard Chartered", "Sterling Bank",
  "SunTrust Bank", "Taj Bank", "Titan Trust Bank", "Union Bank", "UBA", "Unity Bank", "Wema Bank",
  "Zenith Bank", "Other",
];

export const EXPENSE_CATEGORIES = [
  "Contractors & freelancers", "Software & subscriptions", "Office rent", "Internet & phone", "Diesel & power",
  "Salaries & wages", "Pension (employer)", "Marketing & advertising", "Travel & transport", "Professional fees",
  "Equipment & devices", "Office supplies", "Bank charges", "Training", "Insurance", "Taxes & levies",
  "Cost of sales", "Other",
];

/** Categories payroll writes on its own; hidden from the manual expense form. */
export const PAYROLL_CATEGORIES = ["Salaries & wages", "Pension (employer)"];

export const PAYMENT_METHODS: Record<string, string> = {
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  POS: "POS",
  PAYSTACK: "Paystack",
  FLUTTERWAVE: "Flutterwave",
  OTHER: "Other",
};

export const FREQUENCIES: Record<string, string> = {
  WEEKLY: "Every week",
  MONTHLY: "Every month",
  QUARTERLY: "Every 3 months",
  YEARLY: "Every year",
};

export const INVOICE_STATUS: Record<string, { label: string; tone: "neutral" | "brand" | "sun" | "danger" | "info" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SENT: { label: "Awaiting payment", tone: "info" },
  PARTIAL: { label: "Part paid", tone: "sun" },
  PAID: { label: "Paid", tone: "brand" },
  VOID: { label: "Cancelled", tone: "neutral" },
  ACCEPTED: { label: "Accepted", tone: "brand" },
  CONVERTED: { label: "Invoiced", tone: "brand" },
};

export const CANCEL_REASONS = [
  { value: "TOO_EXPENSIVE", label: "It costs too much right now" },
  { value: "NOT_USING", label: "I'm not using it enough" },
  { value: "SEASONAL", label: "My business is slow or seasonal at the moment" },
  { value: "MISSING_FEATURE", label: "It's missing something I need" },
  { value: "SWITCHING", label: "I'm moving to another app" },
  { value: "TECHNICAL", label: "Something isn't working properly" },
  { value: "CLOSED", label: "I've closed or paused my business" },
  { value: "OTHER", label: "Something else" },
] as const;

/*
  Growth programme. Everyone starts with a Pro trial (a "reverse trial": at the end they fall back to Free,
  nothing is deleted). Referred businesses get a longer trial; referrers earn Pro time and fee-free payments
  once the business they referred is genuinely using BizBooks.
*/
export const TRIAL = {
  days: 30,
  referredDays: 60,
  bonusDays: 7,
  // Earn-more-days steps: the habits that predict a business sticking around.
  bonuses: [
    { key: "FIRST_INVOICE", label: "Send your first invoice" },
    { key: "GET_PAID", label: "Turn on online payments" },
    { key: "PAYROLL_OR_IMPORT", label: "Run payroll or import from Wave or Zoho" },
  ],
  // Turning on BizBooks Payments during the trial also adds these fee-free payments.
  paymentsBonusFeeFree: 5,
} as const;

export const REFERRAL = {
  rewardMonths: 3,
  rewardFeeFree: 10,
  // Pro time can bank up to this far ahead (lifetime Pro is the exception).
  bankCapMonths: 24,
  // A referral qualifies once the referred business sends 3 invoices to 2+ clients and a client opens one,
  // or takes a payment through BizBooks Payments, within this many days of joining.
  qualifyWithinDays: 60,
  minInvoices: 3,
  minClients: 2,
  // Without an online payment (a signal one person can't easily fake), only this many of a referrer's
  // referrals qualify automatically; the rest wait for a quick check by BizBooks (status REVIEW).
  autoQualifyWithoutPayment: 2,
  milestones: [
    { count: 3, label: "A year of Pro and a Partner badge", bonusMonths: 3 },
    { count: 10, label: "Pro free for life", lifetime: true },
    { count: 25, label: "Lifetime Pro plus a free Advisors bookkeeping review", lifetime: true },
  ],
} as const;

/** Stands in for "forever" on lifetime Pro. */
export const LIFETIME_PRO_UNTIL = new Date("2099-12-31T00:00:00Z");
