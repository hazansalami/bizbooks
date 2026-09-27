/** Round to kobo. Every stored amount passes through here. */
export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function naira(amount: number | null | undefined, opts: { kobo?: boolean } = {}) {
  if (amount == null) return "";
  const hasKobo = opts.kobo ?? Math.round(amount * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: hasKobo ? 2 : 0,
    maximumFractionDigits: hasKobo ? 2 : 0,
  }).format(amount);
}

/** Short form for dashboards: ₦1.2m, ₦450k. */
export function nairaShort(amount: number) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}₦${trim(abs / 1_000_000_000)}bn`;
  if (abs >= 1_000_000) return `${sign}₦${trim(abs / 1_000_000)}m`;
  if (abs >= 10_000) return `${sign}₦${trim(abs / 1_000)}k`;
  return naira(amount);
}

function trim(n: number) {
  return n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, "");
}

/** Parse "₦1,250.50" or "1250.5" from a form. */
export function parseAmount(v: unknown) {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v !== "string") return NaN;
  const cleaned = v.replace(/[₦,\s]/g, "");
  if (!cleaned) return NaN;
  return Number(cleaned);
}

export type LineInput = { description: string; quantity: number; unitPrice: number };

export type InvoiceTotals = {
  subtotal: number; discount: number; taxable: number; vatAmount: number; whtAmount: number; total: number; amountDue: number;
};

/**
 * VAT is charged on (subtotal − discount). WHT is the customer's deduction at source, worked out on
 * the pre-VAT amount; it lowers what the customer actually sends, not the invoice total.
 */
export function computeTotals(lines: LineInput[], discount: number, vatRate: number, whtRate: number): InvoiceTotals {
  const subtotal = round2(lines.reduce((s, l) => s + round2(l.quantity * l.unitPrice), 0));
  const d = round2(Math.min(Math.max(discount, 0), subtotal));
  const taxable = round2(subtotal - d);
  const vatAmount = round2((taxable * vatRate) / 100);
  const whtAmount = round2((taxable * whtRate) / 100);
  const total = round2(taxable + vatAmount);
  return { subtotal, discount: d, taxable, vatAmount, whtAmount, total, amountDue: round2(total - whtAmount) };
}

/** What the customer still has to send. */
export function balanceDue(inv: { total: number; whtAmount: number; amountPaid: number }) {
  return Math.max(0, round2(inv.total - inv.whtAmount - inv.amountPaid));
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
    if (n) parts.push("and");
  }
  if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""));
  else if (n) parts.push(ONES[n]);
  return parts.join(" ");
}

/** "One hundred and fifty thousand naira, fifty kobo" — Nigerian invoices and receipts often show this. */
export function amountInWords(amount: number) {
  const whole = Math.floor(amount);
  const kobo = Math.round((amount - whole) * 100);
  const scales: [number, string][] = [[1_000_000_000, "billion"], [1_000_000, "million"], [1_000, "thousand"]];
  let n = whole;
  const parts: string[] = [];
  for (const [value, name] of scales) {
    if (n >= value) {
      parts.push(`${below1000(Math.floor(n / value))} ${name}`);
      n %= value;
    }
  }
  if (n) parts.push((parts.length && n < 100 ? "and " : "") + below1000(n));
  let words = parts.length ? parts.join(", ").replace(/, and/g, " and") : "zero";
  words += " naira";
  if (kobo) words += `, ${below1000(kobo)} kobo`;
  return words.charAt(0).toUpperCase() + words.slice(1) + " only";
}
