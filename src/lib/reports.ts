import "server-only";
import { db } from "./db";
import { round2 } from "./money";
import { monthStart, paidExpensesWhere } from "./finance";

export const PERIODS = {
  "this-month": "This month",
  "last-month": "Last month",
  "this-quarter": "This quarter",
  "this-year": "This year",
  "last-12": "Last 12 months",
} as const;
export type Period = keyof typeof PERIODS;

export function periodRange(p: Period, now = new Date()): { from: Date; to: Date } {
  switch (p) {
    case "last-month": return { from: monthStart(now, -1), to: monthStart(now) };
    case "this-quarter": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return { from: new Date(now.getFullYear(), q, 1), to: new Date(now.getFullYear(), q + 3, 1) };
    }
    case "this-year": return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
    case "last-12": return { from: monthStart(now, -11), to: monthStart(now, 1) };
    default: return { from: monthStart(now), to: monthStart(now, 1) };
  }
}

/** The period just before, for "vs last month" comparisons. */
export function previousRange(p: Period, now = new Date()): { from: Date; to: Date; label: string } {
  const { from, to } = periodRange(p, now);
  const months = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
  const labels: Record<Period, string> = { "this-month": "last month", "last-month": "the month before", "this-quarter": "last quarter", "this-year": "last year", "last-12": "the 12 months before" };
  return { from: new Date(from.getFullYear(), from.getMonth() - months, 1), to: from, label: labels[p] };
}

/**
 * Cash-basis report: income is money actually received in the period. Small businesses think
 * in cash, and it matches what they see in their bank app.
 */
export async function profitAndLoss(businessId: string, from: Date, to: Date) {
  const [payments, expenses] = await Promise.all([
    db.payment.findMany({ where: { businessId, paidAt: { gte: from, lt: to } }, include: { invoice: true } }),
    db.expense.findMany({ where: paidExpensesWhere(businessId, from, to) }),
  ]);
  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);

  // Split each payment into its VAT share (money you hold for the government) and your own income.
  let vatCollected = 0;
  let whtSuffered = 0;
  for (const p of payments) {
    const inv = p.invoice;
    if (!inv) continue;
    const payable = inv.total - inv.whtAmount;
    if (payable <= 0) continue;
    const share = p.amount / payable;
    vatCollected += inv.vatAmount * share;
    whtSuffered += inv.whtAmount * share;
  }
  const moneyIn = round2(payments.reduce((s, p) => s + p.amount, 0));
  const moneyOut = round2(expenses.reduce((s, e) => s + e.amount, 0));
  const inputVat = round2(expenses.reduce((s, e) => s + e.vatAmount, 0));
  vatCollected = round2(vatCollected);
  const income = round2(moneyIn - vatCollected);
  return {
    moneyIn, income, moneyOut, profit: round2(income - (moneyOut - inputVat)),
    categories: [...byCategory.entries()].map(([name, amount]) => ({ name, amount: round2(amount) })).sort((a, b) => b.amount - a.amount),
    vatCollected, inputVat, vatToRemit: round2(Math.max(0, vatCollected - inputVat)), whtSuffered: round2(whtSuffered),
    paymentCount: payments.length,
  };
}

/** Turnover (sales before VAT) over the last 12 months, for the small-company check. */
export async function trailingTurnover(businessId: string) {
  const from = monthStart(new Date(), -11);
  const r = await profitAndLoss(businessId, from, monthStart(new Date(), 1));
  return round2(r.income + r.whtSuffered);
}

/**
 * VAT for a period on the accrual basis: output VAT on invoices issued (not drafts or cancelled),
 * input VAT on expenses and bills dated in the period.
 */
export async function vatSummary(businessId: string, from: Date, to: Date) {
  const [inv, exp] = await Promise.all([
    db.invoice.findMany({ where: { businessId, kind: "INVOICE", status: { notIn: ["DRAFT", "VOID"] }, issueDate: { gte: from, lt: to }, vatAmount: { gt: 0 } }, include: { customer: true }, orderBy: { issueDate: "asc" } }),
    db.expense.findMany({ where: { businessId, date: { gte: from, lt: to }, vatAmount: { gt: 0 } }, orderBy: { date: "asc" } }),
  ]);
  const output = round2(inv.reduce((s, i) => s + i.vatAmount, 0));
  const input = round2(exp.reduce((s, e) => s + e.vatAmount, 0));
  return { invoices: inv, expenses: exp, output, input, net: round2(output - input) };
}
