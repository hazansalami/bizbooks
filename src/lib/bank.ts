import "server-only";
import { createHash } from "crypto";
import { db } from "./db";
import { balanceDue, round2 } from "./money";
import { addDays } from "./utils";
import { column, dateOrderOf, norm, parseCSV, parseDate, parseMoney } from "./import/values";

/*
  Bank statements in, books reconciled. Lines come from a CSV statement (every Nigerian bank's internet
  banking exports one) or a Mono bank feed. Each line is matched to what's already recorded (a payment, an
  expense), or offered as a one-tap fix: "record this as payment for INV-0031", "add this as an expense".
*/

export type StatementLine = { date: Date; description: string; amount: number; balance: number | null; externalId?: string };

/** Times and weekday names that some banks add to the date ("06/10/2026 14:22", "Mon, 06 Oct 2026"). */
const cleanDate = (v: string) => v.trim().replace(/^[A-Za-z]{3},?\s+/, "").replace(/[T\s]+\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*(am|pm|Z)?.*$/i, "");

/**
 * Reads a statement CSV. Column names differ by bank (GTBank "Debits/Credits/Remarks", Kuda "Money In/Money
 * out", First Bank "Withdrawal/Deposit"...), so columns are found by any of their usual names, and the header
 * row can sit below a block of account details.
 */
export function parseStatementCsv(text: string): { lines: StatementLine[]; skipped: number; error?: string } {
  const rows = parseCSV(text).filter((r) => r.some((c) => c.trim() !== ""));
  const isHeader = (r: string[]) => {
    const h = r.map(norm);
    const hasDate = h.some((c) => /\bdate\b|^time|trans time/.test(c));
    const hasMoney = h.some((c) => /debit|credit|withdraw|deposit|money in|money out|amount|paid in|paid out/.test(c));
    return hasDate && hasMoney;
  };
  const headerAt = rows.findIndex(isHeader);
  if (headerAt < 0) return { lines: [], skipped: 0, error: "We couldn't find the date and amount columns. Download the statement from your bank's internet banking as CSV (or open the Excel file and save it as CSV) and try again." };
  const h = rows[headerAt];
  const c = {
    date: column(h, "transaction date", "trans date", "tran date", "trans. date", "posted date", "date posted", "posting date", "booking date", "date/time", "trans. time", "date", "value date"),
    desc: column(h, "narration", "description", "remarks", "details", "transaction details", "particulars", "narrative", "memo", "beneficiary"),
    party: column(h, "to / from", "to/from", "counterparty", "beneficiary name"),
    debit: column(h, "debit", "debits", "debit amount", "withdrawal", "withdrawals", "money out", "paid out", "dr", "debit(₦)", "debit (ngn)"),
    credit: column(h, "credit", "credits", "credit amount", "deposit", "deposits", "lodgement", "lodgements", "money in", "paid in", "cr", "credit(₦)", "credit (ngn)"),
    amount: column(h, "amount", "transaction amount", "amount (ngn)"),
    type: column(h, "type", "dr/cr", "debit/credit", "transaction type"),
    balance: column(h, "balance", "running balance", "balance after", "available balance", "closing balance", "ledger balance"),
  };
  if (c.date < 0 || (c.debit < 0 && c.credit < 0 && c.amount < 0)) return { lines: [], skipped: 0, error: "The statement needs a date column and either debit/credit columns or an amount column." };
  const body = rows.slice(headerAt + 1);
  const { order } = dateOrderOf(body.map((r) => cleanDate(r[c.date] ?? "")));
  const lines: StatementLine[] = [];
  let skipped = 0;
  for (const r of body) {
    const iso = parseDate(cleanDate(r[c.date] ?? ""), order);
    let amount = NaN;
    if (c.debit >= 0 || c.credit >= 0) {
      const dr = Math.abs(parseMoney(r[c.debit]) || 0), cr = Math.abs(parseMoney(r[c.credit]) || 0);
      amount = cr - dr;
    }
    if (!(Math.abs(amount) > 0) && c.amount >= 0) {
      amount = parseMoney(r[c.amount]);
      const t = norm(r[c.type] ?? "");
      if (c.type >= 0 && /^(d|dr|debit)/.test(t)) amount = -Math.abs(amount);
      else if (c.type >= 0 && /^(c|cr|credit)/.test(t)) amount = Math.abs(amount);
    }
    const description = [c.party >= 0 ? r[c.party] : "", c.desc >= 0 ? r[c.desc] : ""].map((x) => (x ?? "").trim()).filter(Boolean).join(" · ");
    // Opening/closing balance rows and totals have no date or no movement.
    if (!iso || !(Math.abs(amount) > 0) || /opening balance|closing balance|^total/i.test(description)) { skipped++; continue; }
    const bal = c.balance >= 0 ? parseMoney(r[c.balance]) : NaN;
    lines.push({ date: new Date(`${iso}T12:00:00`), description: (description || "No description").slice(0, 300), amount: round2(amount), balance: Number.isFinite(bal) ? round2(bal) : null });
  }
  return { lines, skipped };
}

/** Identical lines on the same day (two ₦500 POS charges) are told apart by their position in the file. */
function hashes(lines: StatementLine[], source: string) {
  const seen = new Map<string, number>();
  return lines.map((l) => {
    if (l.externalId) return `${source}:${l.externalId}`;
    const key = `${l.date.toISOString().slice(0, 10)}|${l.amount}|${norm(l.description)}|${l.balance ?? ""}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return createHash("sha1").update(`${key}|${n}`).digest("hex");
  });
}

/** Saves new lines (skipping ones already imported), matches them, and updates the cash balance. */
export async function importLines(businessId: string, lines: StatementLine[], o: { source: "CSV" | "MONO"; account?: string | null; connectionId?: string }) {
  const hs = hashes(lines, o.source);
  const created = await db.bankTransaction.createMany({
    data: lines.map((l, i) => ({
      businessId, date: l.date, description: l.description, amount: l.amount, balance: l.balance, account: o.account ?? null,
      source: o.source, hash: hs[i], connectionId: o.connectionId ?? null,
    })),
    skipDuplicates: true,
  });
  const result = await matchBankLines(businessId);
  // The latest line with a balance is today's cash position, if it's newer than what the forecast knows.
  const latest = closingLine(lines);
  if (latest) {
    const b = await db.business.findUnique({ where: { id: businessId }, select: { cashBalanceAt: true } });
    if (!b?.cashBalanceAt || b.cashBalanceAt < latest.date) {
      await db.business.update({ where: { id: businessId }, data: { cashBalance: latest.balance, cashBalanceAt: latest.date } });
    }
  }
  return { added: created.count, duplicates: lines.length - created.count, ...result };
}

/**
 * The last line by date that shows a balance. Several lines share the last day, so the file's own order
 * decides: oldest-first statements end with it, newest-first statements start with it.
 */
function closingLine(lines: StatementLine[]) {
  const withBal = lines.filter((l) => l.balance != null);
  if (!withBal.length) return null;
  const last = Math.max(...withBal.map((l) => l.date.getTime()));
  const sameDay = withBal.filter((l) => l.date.getTime() === last);
  const ascending = withBal[0].date.getTime() <= withBal[withBal.length - 1].date.getTime();
  return ascending ? sameDay[sameDay.length - 1] : sameDay[0];
}

const near = (a: number, b: number) => Math.abs(a - b) <= 1;
const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 2 && !["ltd", "limited", "plc", "nigeria", "the", "and", "enterprises", "ventures", "services", "company"].includes(w)));

/**
 * Links unmatched lines to what's already recorded, within 3 days and ₦1:
 *   money in  → a payment not yet linked; otherwise suggests an open naira invoice for the same amount
 *               (the client's name or invoice number in the narration settles a tie).
 *   money out → an expense not yet linked; otherwise suggests an unpaid bill for the same amount.
 */
export async function matchBankLines(businessId: string) {
  const open = await db.bankTransaction.findMany({ where: { businessId, status: "UNMATCHED" }, orderBy: { date: "asc" }, take: 2000 });
  if (!open.length) return { matched: 0, suggested: 0 };
  const from = addDays(open[0].date, -4), to = addDays(open[open.length - 1].date, 4);
  const [payments, expenses, invoices, bills] = await Promise.all([
    db.payment.findMany({ where: { businessId, paidAt: { gte: from, lte: to }, bankTransactions: { none: {} } }, select: { id: true, amount: true, exchangeRate: true, paidAt: true } }),
    db.expense.findMany({ where: { businessId, paid: true, bankTransactions: { none: {} }, OR: [{ paidAt: { gte: from, lte: to } }, { paidAt: null, date: { gte: from, lte: to } }] }, select: { id: true, amount: true, date: true, paidAt: true } }),
    db.invoice.findMany({ where: { businessId, kind: "INVOICE", currency: "NGN", status: { in: ["SENT", "PARTIAL"] } }, select: { id: true, number: true, total: true, amountPaid: true, whtAmount: true, customer: { select: { name: true } } } }),
    db.expense.findMany({ where: { businessId, paid: false }, select: { id: true, amount: true, vendor: true } }),
  ]);
  const usedP = new Set<string>(), usedE = new Set<string>();
  let matched = 0, suggested = 0;
  for (const t of open) {
    const within = (d: Date) => Math.abs(d.getTime() - t.date.getTime()) <= 3.5 * 864e5;
    if (t.amount > 0) {
      const p = payments.find((p) => !usedP.has(p.id) && within(p.paidAt) && near(p.amount * p.exchangeRate, t.amount));
      if (p) {
        usedP.add(p.id);
        await db.bankTransaction.update({ where: { id: t.id }, data: { status: "MATCHED", paymentId: p.id, suggestedId: null } });
        matched++;
        continue;
      }
      const narr = norm(t.description);
      const candidates = invoices.filter((i) => near(balanceDue(i), t.amount));
      const named = candidates.filter((i) => narr.includes(norm(i.number)) || [...words(i.customer.name)].some((w) => narr.split(" ").includes(w)));
      const pick = named.length === 1 ? named[0] : candidates.length === 1 ? candidates[0] : null;
      if (pick && pick.id !== t.suggestedId) {
        await db.bankTransaction.update({ where: { id: t.id }, data: { suggestedId: pick.id } });
        suggested++;
      }
    } else {
      const out = -t.amount;
      const e = expenses.find((e) => !usedE.has(e.id) && within(e.paidAt ?? e.date) && near(e.amount, out));
      if (e) {
        usedE.add(e.id);
        await db.bankTransaction.update({ where: { id: t.id }, data: { status: "MATCHED", expenseId: e.id, suggestedId: null } });
        matched++;
        continue;
      }
      const cands = bills.filter((b) => near(b.amount, out));
      const narr = norm(t.description);
      const named = cands.filter((b) => b.vendor && [...words(b.vendor)].some((w) => narr.split(" ").includes(w)));
      const pick = named.length === 1 ? named[0] : cands.length === 1 ? cands[0] : null;
      if (pick && pick.id !== t.suggestedId) {
        await db.bankTransaction.update({ where: { id: t.id }, data: { suggestedId: pick.id } });
        suggested++;
      }
    }
  }
  return { matched, suggested };
}

/** A best guess at who was paid, for the expense's supplier field: "TRF TO ADEKUNLE STORES/REF 123" → "Adekunle Stores". */
export function vendorFrom(description: string) {
  // "To / From" comes first when the bank has that column (Kuda, Opay).
  const s = description.split("·")[0]
    .replace(/\b(trf|transfer|nip|pos|web|purchase|payment|pmt|to|frm|from|by|ref|fip|mob|usd|ngn|nxg)\b[:/]*/gi, " ")
    .replace(/[/|*#:]+.*$/, "")
    .replace(/\d{5,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s ? s.toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase()).slice(0, 80) : null;
}

const GUESSES: [RegExp, string][] = [
  [/\b(sms alert|stamp duty|maintenance fee|maint fee|comm(ission)?|charge|chg|vat on|cot|emtl|nip fee|transfer fee)\b/i, "Bank charges"],
  [/\b(mtn|airtel|glo|9mobile|t2|spectranet|starlink|smile|ipnx|data|airtime|dstv|gotv)\b/i, "Internet & phone"],
  [/\b(diesel|ikedc|ekedc|aedc|phed|ibedc|eedc|electricity|prepaid meter|nepa|phcn)\b/i, "Diesel & power"],
  [/\b(uber|bolt|indrive|fuel|filling station|petrol|air peace|arik|ibom air|flight)\b/i, "Travel & transport"],
  [/\b(google ads|facebook|meta|instagram|tiktok|linkedin|ads)\b/i, "Marketing & advertising"],
  [/\b(aws|amazon web|microsoft|google workspace|gsuite|zoom|notion|slack|figma|canva|adobe|github|openai|anthropic|vercel|netflix|apple\.com|subscription)\b/i, "Software & subscriptions"],
  [/\b(firs|lirs|tax|nrs|levy)\b/i, "Taxes & levies"],
  [/\b(rent)\b/i, "Office rent"],
];

/** A first guess at the expense category from the narration; the owner can change it before adding. */
export function guessCategory(description: string) {
  return GUESSES.find(([re]) => re.test(description))?.[1];
}
