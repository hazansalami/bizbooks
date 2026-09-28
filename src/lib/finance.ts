import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { round2 } from "./money";
import { daysBetween } from "./utils";

/*
  Two views of the same books, like Wave:
  - Cash basis: money that actually moved. Payments received, and expenses/bills on the day they were paid.
  - Accrual basis: what was earned and incurred. Invoices on their issue date, expenses/bills on their own date.
  Amounts are before VAT (VAT is the government's money) on the accrual side.
*/

export function monthStart(d = new Date(), offset = 0) {
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}

/** Expenses paid between two dates: paid bills count on their paid date, ordinary expenses on their date. */
export function paidExpensesWhere(businessId: string, from: Date, to: Date): Prisma.ExpenseWhereInput {
  return {
    businessId,
    paid: true,
    OR: [{ paidAt: { gte: from, lt: to } }, { paidAt: null, date: { gte: from, lt: to } }],
  };
}

export const cashDate = (e: { date: Date; paidAt: Date | null }) => e.paidAt ?? e.date;

type MonthRow = { key: string; label: string; start: Date };
function months(n: number, end = new Date()): MonthRow[] {
  return Array.from({ length: n }, (_, i) => {
    const start = monthStart(end, -(n - 1) + i);
    return { key: `${start.getFullYear()}-${start.getMonth()}`, label: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(start), start };
  });
}
const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

export async function cashFlowSeries(businessId: string, n = 12) {
  const rows = months(n);
  const from = rows[0].start;
  const to = monthStart(new Date(), 1);
  const [payments, expenses] = await Promise.all([
    db.payment.findMany({ where: { businessId, paidAt: { gte: from, lt: to } }, select: { amount: true, paidAt: true, exchangeRate: true } }),
    db.expense.findMany({ where: paidExpensesWhere(businessId, from, to), select: { amount: true, date: true, paidAt: true } }),
  ]);
  const out = rows.map((r) => ({ label: r.label, key: r.key, inflow: 0, outflow: 0, net: 0 }));
  const find = (d: Date) => out.find((r) => r.key === keyOf(d));
  for (const p of payments) { const r = find(p.paidAt); if (r) r.inflow += p.amount * p.exchangeRate; }
  for (const e of expenses) { const r = find(cashDate(e)); if (r) r.outflow += e.amount; }
  return out.map((r) => ({ ...r, inflow: round2(r.inflow), outflow: round2(r.outflow), net: round2(r.inflow - r.outflow) }));
}

export async function accrualSeries(businessId: string, n = 12) {
  const rows = months(n);
  const from = rows[0].start;
  const to = monthStart(new Date(), 1);
  const [invoices, expenses] = await Promise.all([
    db.invoice.findMany({ where: { businessId, kind: "INVOICE", status: { notIn: ["DRAFT", "VOID"] }, issueDate: { gte: from, lt: to } }, select: { subtotal: true, discount: true, issueDate: true, exchangeRate: true } }),
    db.expense.findMany({ where: { businessId, date: { gte: from, lt: to } }, select: { amount: true, vatAmount: true, date: true } }),
  ]);
  const out = rows.map((r) => ({ label: r.label, key: r.key, income: 0, expenses: 0 }));
  const find = (d: Date) => out.find((r) => r.key === keyOf(d));
  for (const i of invoices) { const r = find(i.issueDate); if (r) r.income += (i.subtotal - i.discount) * i.exchangeRate; }
  for (const e of expenses) { const r = find(e.date); if (r) r.expenses += e.amount - e.vatAmount; }
  return out.map((r) => ({ ...r, income: round2(r.income), expenses: round2(r.expenses) }));
}

/** Accrual income and expenses for any range, with the expense breakdown by category. */
export async function accrualTotals(businessId: string, from: Date, to: Date) {
  const [inv, expenses] = await Promise.all([
    db.invoice.findMany({ where: { businessId, kind: "INVOICE", status: { notIn: ["DRAFT", "VOID"] }, issueDate: { gte: from, lt: to } }, select: { subtotal: true, discount: true, exchangeRate: true } }),
    db.expense.findMany({ where: { businessId, date: { gte: from, lt: to } }, select: { amount: true, vatAmount: true, category: true } }),
  ]);
  const income = round2(inv.reduce((s, i) => s + (i.subtotal - i.discount) * i.exchangeRate, 0));
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount - e.vatAmount);
  const categories = [...byCat.entries()].map(([name, amount]) => ({ name, amount: round2(amount) })).sort((a, b) => b.amount - a.amount);
  const total = round2(categories.reduce((s, c) => s + c.amount, 0));
  return { income, expenses: total, net: round2(income - total), categories };
}

export type Aging = { comingDue: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number; total: number };
function bucket(a: Aging, amount: number, late: number) {
  if (late <= 0) a.comingDue += amount;
  else if (late <= 30) a.d1_30 += amount;
  else if (late <= 60) a.d31_60 += amount;
  else if (late <= 90) a.d61_90 += amount;
  else a.d90plus += amount;
  a.total += amount;
}
const emptyAging = (): Aging => ({ comingDue: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 });

/** Unpaid bills, oldest first, bucketed like Wave's "Bills you owe". */
export async function payables(businessId: string) {
  const bills = await db.expense.findMany({ where: { businessId, paid: false }, orderBy: [{ dueDate: "asc" }, { date: "asc" }] });
  const now = new Date();
  const aging = emptyAging();
  const rows = bills.map((b) => {
    const due = b.dueDate ?? b.date;
    const late = daysBetween(due, now);
    bucket(aging, b.amount, late);
    return { bill: b, due, late };
  });
  return { rows, aging };
}

export function agingOf(items: { amount: number; late: number }[]) {
  const a = emptyAging();
  for (const i of items) bucket(a, i.amount, i.late);
  return a;
}
