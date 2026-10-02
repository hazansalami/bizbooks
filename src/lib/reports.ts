import "server-only";
import { db } from "./db";
import { round2 } from "./money";
import { cashDate, monthStart, paidExpensesWhere } from "./finance";

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
    // Shares are in the invoice currency; the payment's own rate turns them into naira.
    const share = p.amount / payable;
    vatCollected += inv.vatAmount * share * p.exchangeRate;
    whtSuffered += inv.whtAmount * share * p.exchangeRate;
  }
  const moneyIn = round2(payments.reduce((s, p) => s + p.amount * p.exchangeRate, 0));
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
  // VAT is declared in naira, so foreign-currency invoices convert at their own rate.
  const invoices = inv.map((i) => ({ ...i, netNgn: round2((i.subtotal - i.discount) * i.exchangeRate), vatNgn: round2(i.vatAmount * i.exchangeRate) }));
  const output = round2(invoices.reduce((s, i) => s + i.vatNgn, 0));
  const input = round2(exp.reduce((s, e) => s + e.vatAmount, 0));
  return { invoices, expenses: exp, output, input, net: round2(output - input) };
}

/* ---------- Report detail: the transactions behind each line ---------- */

export type DetailLine = { id: string; date: Date; name: string; ref: string; href: string; amount: number };
export type DetailGroup = { name: string; amount: number; lines: DetailLine[] };

const sumOf = (lines: { amount: number }[]) => round2(lines.reduce((s, l) => s + l.amount, 0));
const expenseHref = (e: { id: string; payRunId: string | null }) => (e.payRunId ? `/app/payroll/runs/${e.payRunId}` : `/app/expenses/${e.id}`);

/**
 * Profit and loss with every figure traceable: income lines (invoices on accrual, payments on cash) and
 * expenses grouped by category, all in naira and before VAT. Totals are the sums of the lines shown, so
 * the detail always adds up to the summary.
 */
export async function profitAndLossDetail(businessId: string, from: Date, to: Date, basis: "accrual" | "cash") {
  let income: DetailLine[];
  if (basis === "accrual") {
    const inv = await db.invoice.findMany({
      where: { businessId, kind: "INVOICE", status: { notIn: ["DRAFT", "VOID"] }, issueDate: { gte: from, lt: to } },
      include: { customer: { select: { name: true } } }, orderBy: { issueDate: "asc" },
    });
    income = inv.map((i) => ({ id: i.id, date: i.issueDate, name: i.customer.name, ref: i.title ? `${i.number} · ${i.title}` : i.number, href: `/app/invoices/${i.id}`, amount: round2((i.subtotal - i.discount) * i.exchangeRate) }));
  } else {
    const pays = await db.payment.findMany({
      where: { businessId, paidAt: { gte: from, lt: to } },
      include: { invoice: { include: { customer: { select: { name: true } } } } }, orderBy: { paidAt: "asc" },
    });
    // The VAT share of each payment is the government's money, so income is the rest (as in profitAndLoss).
    income = pays.map((p) => {
      const inv = p.invoice;
      const payable = inv ? inv.total - inv.whtAmount : 0;
      const vat = inv && payable > 0 ? inv.vatAmount * (p.amount / payable) : 0;
      return {
        id: p.id, date: p.paidAt, name: inv?.customer.name ?? "Payment", ref: inv ? `${inv.number}${p.note ? ` · ${p.note}` : ""}` : p.note ?? "",
        href: inv ? `/app/invoices/${inv.id}` : "/app/payments", amount: round2((p.amount - vat) * p.exchangeRate),
      };
    });
  }

  const expenses = await db.expense.findMany({
    where: basis === "accrual" ? { businessId, date: { gte: from, lt: to } } : paidExpensesWhere(businessId, from, to),
    orderBy: { date: "asc" },
  });
  const groups = new Map<string, DetailLine[]>();
  for (const e of expenses) {
    const line = { id: e.id, date: basis === "cash" ? cashDate(e) : e.date, name: e.vendor || "—", ref: e.note ?? "", href: expenseHref(e), amount: round2(e.amount - e.vatAmount) };
    (groups.get(e.category) ?? groups.set(e.category, []).get(e.category)!).push(line);
  }
  const categories: DetailGroup[] = [...groups.entries()]
    .map(([name, lines]) => ({ name, amount: sumOf(lines), lines: lines.sort((a, b) => a.date.getTime() - b.date.getTime()) }))
    .sort((a, b) => b.amount - a.amount);
  const incomeTotal = sumOf(income);
  const expenseTotal = round2(categories.reduce((s, c) => s + c.amount, 0));
  return { income: { name: "Income", amount: incomeTotal, lines: income } as DetailGroup, categories, expenses: expenseTotal, net: round2(incomeTotal - expenseTotal) };
}

/** Cash flow by month, with the payments in and money out behind each month's figures. */
export async function cashFlowDetail(businessId: string, from: Date, to: Date) {
  const [payments, expenses] = await Promise.all([
    db.payment.findMany({ where: { businessId, paidAt: { gte: from, lt: to } }, include: { invoice: { include: { customer: { select: { name: true } } } } } }),
    db.expense.findMany({ where: paidExpensesWhere(businessId, from, to) }),
  ]);
  type Month = { key: string; inflow: DetailLine[]; outflow: DetailLine[]; payroll: DetailLine[] };
  const byMonth = new Map<string, Month>();
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const month = (k: string) => byMonth.get(k) ?? byMonth.set(k, { key: k, inflow: [], outflow: [], payroll: [] }).get(k)!;
  for (const p of payments) {
    month(key(p.paidAt)).inflow.push({
      id: p.id, date: p.paidAt, name: p.invoice?.customer.name ?? "Payment", ref: p.invoice ? p.invoice.number : p.note ?? "",
      href: p.invoice ? `/app/invoices/${p.invoice.id}` : "/app/payments", amount: round2(p.amount * p.exchangeRate),
    });
  }
  for (const e of expenses) {
    const d = cashDate(e);
    const line = { id: e.id, date: d, name: e.vendor || (e.payRunId ? "Payroll" : "—"), ref: [e.category, e.note].filter(Boolean).join(" · "), href: expenseHref(e), amount: e.amount };
    (e.payRunId ? month(key(d)).payroll : month(key(d)).outflow).push(line);
  }
  const byDate = (a: DetailLine, b: DetailLine) => a.date.getTime() - b.date.getTime();
  return [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key)).map((m) => ({
    ...m, inflow: m.inflow.sort(byDate), outflow: m.outflow.sort(byDate), payroll: m.payroll.sort(byDate),
    totals: { inflow: sumOf(m.inflow), outflow: sumOf(m.outflow), payroll: sumOf(m.payroll) },
  }));
}
