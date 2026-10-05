import "server-only";
import { db } from "./db";
import { round2 } from "./money";
import { addDays } from "./utils";
import { column, norm, parseCSV, parseDate, parseMoney } from "./import/values";

/*
  Withholding tax recovery (opt-in per business).
  When a client deducts WHT (5% of consultancy fees, 2% of supply contracts...), that money is only a
  credit against your company income tax if the client remits it under your TIN. The tax authority's
  TaxPro-Max portal lists the credits that actually arrived. BizBooks compares that list with every
  deduction on your paid invoices: credited, still within the normal remittance window, or missing.
*/

export type WhtStatus = "CREDITED" | "WAITING" | "MISSING";
export type Deduction = {
  invoiceId: string; number: string; customerId: string; customerName: string; customerTin: string | null; customerEmail: string | null; customerPhone: string | null;
  paidAt: Date; amount: number; status: WhtStatus; expectedBy: Date; creditId: string | null; chasedAt: Date | null; publicToken: string;
};

/** The deducting client must remit by the 21st of the month after payment; allow 30 days for it to show on TaxPro-Max. */
export function expectedBy(paidAt: Date) {
  return addDays(new Date(paidAt.getFullYear(), paidAt.getMonth() + 1, 21), 30);
}

/** Every WHT deduction on a paid invoice (from `since`), with whether its credit has arrived. */
export async function whtDeductions(businessId: string, since: Date) {
  const invoices = await db.invoice.findMany({
    where: { businessId, kind: "INVOICE", status: "PAID", whtAmount: { gt: 0 }, paidAt: { gte: since } },
    include: { customer: { select: { name: true, tin: true, email: true, phone: true } }, whtCredits: { select: { id: true } } },
    orderBy: { paidAt: "desc" },
  });
  const now = new Date();
  return invoices.map<Deduction>((i) => {
    const due = expectedBy(i.paidAt!);
    const creditId = i.whtCredits[0]?.id ?? null;
    return {
      invoiceId: i.id, number: i.number, customerId: i.customerId, customerName: i.customer.name, customerTin: i.customer.tin,
      customerEmail: i.customer.email, customerPhone: i.customer.phone, paidAt: i.paidAt!, amount: round2(i.whtAmount * i.exchangeRate),
      status: creditId ? "CREDITED" : now > due ? "MISSING" : "WAITING", expectedBy: due, creditId, chasedAt: i.whtChasedAt, publicToken: i.publicToken,
    };
  });
}

/* ---------- TaxPro-Max credit list (CSV) ---------- */

export type ParsedCredit = { payerName: string; payerTin: string | null; amount: number; date: Date; reference: string | null };

/**
 * Reads a WHT credit list exported to CSV. Column names vary between exports, so columns are found by any of
 * their usual names. Rows without a payer, amount or date are skipped and counted.
 */
export function parseCreditCsv(text: string): { credits: ParsedCredit[]; skipped: number; error?: string } {
  const rows = parseCSV(text).filter((r) => r.some((c) => c !== ""));
  const headerAt = rows.findIndex((r) => r.filter(Boolean).length >= 3 && r.some((c) => /amount|tax|wht/i.test(c)));
  if (headerAt < 0) return { credits: [], skipped: 0, error: "We couldn't find the columns in this file. Export the WHT credit list from TaxPro-Max as CSV (or save the Excel file as CSV) and try again." };
  const h = rows[headerAt];
  const c = {
    name: column(h, "withholder name", "deductor name", "payer name", "company name", "taxpayer name", "name of withholder", "name"),
    tin: column(h, "withholder tin", "deductor tin", "payer tin", "tin"),
    amount: column(h, "wht amount", "tax amount", "amount withheld", "credit amount", "amount"),
    date: column(h, "transaction date", "payment date", "date of deduction", "receipt date", "date"),
    ref: column(h, "receipt number", "credit note number", "reference number", "document number", "reference", "receipt no", "receipt"),
  };
  if (c.name < 0 || c.amount < 0 || c.date < 0) return { credits: [], skipped: 0, error: "The file needs at least the payer's name, the amount and the date. Check the export includes those columns." };
  const credits: ParsedCredit[] = [];
  let skipped = 0;
  for (const r of rows.slice(headerAt + 1)) {
    const name = (r[c.name] ?? "").trim();
    const amount = Math.abs(parseMoney(r[c.amount]));
    const iso = parseDate(r[c.date]);
    if (!name || !(amount > 0) || !iso) { skipped++; continue; }
    credits.push({ payerName: name.slice(0, 200), payerTin: c.tin >= 0 ? (r[c.tin] ?? "").replace(/\s/g, "").slice(0, 30) || null : null, amount: round2(amount), date: new Date(`${iso}T12:00:00`), reference: c.ref >= 0 ? (r[c.ref] ?? "").trim().slice(0, 100) || null : null });
  }
  return { credits, skipped };
}

/* ---------- Matching ---------- */

const nameWords = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 2 && !["ltd", "limited", "plc", "nigeria", "the", "and", "company"].includes(w)));
function sameClient(credit: { payerName: string; payerTin: string | null }, client: { name: string; tin: string | null }) {
  const tin = (t: string | null) => (t ?? "").replace(/\D/g, "");
  if (credit.payerTin && client.tin && tin(credit.payerTin) && tin(credit.payerTin) === tin(client.tin)) return true;
  const a = nameWords(credit.payerName), b = nameWords(client.name);
  if (!a.size || !b.size) return false;
  const shared = [...b].filter((w) => a.has(w)).length;
  return shared / b.size >= 0.6;
}

/**
 * Links unmatched credits to unmatched deductions: same client (TIN or name) and the same amount (within ₦1),
 * the credit dated on or after the invoice was paid (allowing a week's slack). Closest date wins.
 */
export async function autoMatchCredits(businessId: string) {
  const [credits, invoices] = await Promise.all([
    db.whtCredit.findMany({ where: { businessId, invoiceId: null } }),
    db.invoice.findMany({
      where: { businessId, kind: "INVOICE", status: "PAID", whtAmount: { gt: 0 }, whtCredits: { none: {} } },
      include: { customer: { select: { name: true, tin: true } } },
    }),
  ]);
  const taken = new Set<string>();
  let matched = 0;
  for (const cr of credits.sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const candidates = invoices
      .filter((i) => !taken.has(i.id) && i.paidAt && cr.date >= addDays(i.paidAt, -7) && Math.abs(round2(i.whtAmount * i.exchangeRate) - cr.amount) <= 1 && sameClient(cr, i.customer))
      .sort((a, b) => Math.abs(cr.date.getTime() - a.paidAt!.getTime()) - Math.abs(cr.date.getTime() - b.paidAt!.getTime()));
    const best = candidates[0];
    if (!best) continue;
    taken.add(best.id);
    await db.whtCredit.update({ where: { id: cr.id }, data: { invoiceId: best.id } });
    matched++;
  }
  return matched;
}
