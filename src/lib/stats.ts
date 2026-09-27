import "server-only";
import { db } from "./db";
import { balanceDue, round2 } from "./money";
import { daysBetween } from "./utils";
import { agingOf, cashFlowSeries, monthStart, paidExpensesWhere } from "./finance";

export { monthStart };

export async function moneyInOut(businessId: string, from: Date, to: Date) {
  const [pay, exp] = await Promise.all([
    db.payment.aggregate({ where: { businessId, paidAt: { gte: from, lt: to } }, _sum: { amount: true } }),
    db.expense.aggregate({ where: paidExpensesWhere(businessId, from, to), _sum: { amount: true } }),
  ]);
  const moneyIn = round2(pay._sum.amount ?? 0);
  const moneyOut = round2(exp._sum.amount ?? 0);
  return { moneyIn, moneyOut, profit: round2(moneyIn - moneyOut) };
}

/** Month-by-month cash in/out for the last n months, oldest first. */
export async function monthlySeries(businessId: string, months = 6) {
  const rows = await cashFlowSeries(businessId, months);
  return rows.map((r) => ({ label: r.label, moneyIn: r.inflow, moneyOut: r.outflow }));
}

export async function receivables(businessId: string) {
  const open = await db.invoice.findMany({
    where: { businessId, kind: "INVOICE", status: { in: ["SENT", "PARTIAL"] } },
    include: { customer: true },
    orderBy: { dueDate: "asc" },
  });
  const now = new Date();
  const rows = open.map((inv) => ({ inv, due: balanceDue(inv), late: daysBetween(inv.dueDate, now) }));
  const aging = agingOf(rows.map((r) => ({ amount: r.due, late: r.late })));
  const total = round2(aging.total);
  const overdue = round2(total - aging.comingDue);
  return { rows, total, overdue, aging };
}
