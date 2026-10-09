import "server-only";
import { db } from "./db";
import { balanceDue, computeTotals, round2, type LineInput } from "./money";
import { advance } from "./recurring";
import { computePay, payDateFor, periodOf, periodLabel } from "./payroll";
import { taxObligations } from "./taxes";
import { payerStats } from "./collections";
import { PAYROLL_CATEGORIES, TAX_DEADLINES } from "./constants";
import { addDays, addMonths, formatDate, startOfDay } from "./utils";
import { paidExpensesWhere } from "./finance";

/*
  13-week cash flow forecast: what's expected to come in and go out each week, from what BizBooks already
  knows. Money in: open invoices (expected when each client really pays, from their history, or on a promised
  date) and upcoming recurring invoices. Money out: unpaid bills, recurring costs, payroll, PAYE, pension,
  WHT and VAT. Plus, optionally, everyday spending at the last three months' average.
  It starts from the cash balance the owner last gave (or a bank feed set). Everything is in naira.
*/

export const FORECAST_WEEKS = 13;
export type FlowKind = "INVOICE" | "RECURRING_INVOICE" | "BILL" | "RECURRING_COST" | "PAYROLL" | "TAX" | "EVERYDAY";
export type Flow = { date: Date; label: string; sub: string; amount: number; kind: FlowKind; href?: string; estimate?: boolean };
export type Week = { start: Date; end: Date; inflows: Flow[]; outflows: Flow[]; in: number; out: number; net: number; opening: number; closing: number };

/** Monday of the week containing d. */
export function weekStart(d: Date) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  return addDays(x, -day);
}

function addWorkingDays(d: Date, n: number) {
  const x = new Date(d);
  while (n > 0) { x.setDate(x.getDate() + 1); if (x.getDay() !== 0 && x.getDay() !== 6) n--; }
  return x;
}

export async function cashForecast(business: { id: string; vatRegistered: boolean; payDay: number; cashBalance: number | null; cashBalanceAt: Date | null }, opts: { everyday: boolean } = { everyday: true }) {
  const id = business.id;
  const today = startOfDay(new Date());
  const from = weekStart(today);
  const to = addDays(from, FORECAST_WEEKS * 7);
  const inflows: Flow[] = [];
  const outflows: Flow[] = [];
  // Anything already late is expected "this week", never in the past.
  const notBefore = (d: Date) => (d < today ? today : d);

  const [open, promises, schedules, bills, recurringCosts, team, runs, taxes, recent] = await Promise.all([
    db.invoice.findMany({ where: { businessId: id, kind: "INVOICE", status: { in: ["SENT", "PARTIAL"] } }, include: { customer: { select: { name: true } } } }),
    db.paymentPromise.findMany({ where: { businessId: id, status: "OPEN" } }),
    db.recurringSchedule.findMany({ where: { businessId: id, status: "ACTIVE" }, include: { customer: { select: { name: true } } } }),
    db.expense.findMany({ where: { businessId: id, paid: false } }),
    db.recurringExpense.findMany({ where: { businessId: id, status: "ACTIVE" } }),
    db.employee.findMany({ where: { businessId: id, status: "ACTIVE" } }),
    db.payRun.findMany({ where: { businessId: id, period: { gte: periodOf(addMonths(today, -1)) } }, include: { items: true } }),
    taxObligations(business, 3),
    db.expense.findMany({ where: { ...paidExpensesWhere(id, addMonths(today, -3), today), payRunId: null, recurringExpenseId: null }, select: { amount: true, category: true } }),
  ]);
  // Salaries recorded as ordinary expenses (not through Payroll) are a monthly payment on pay day, not
  // everyday spending.
  const salaryExpenses = recent.filter((e) => PAYROLL_CATEGORIES.includes(e.category));
  const everydayExpenses = recent.filter((e) => !PAYROLL_CATEGORIES.includes(e.category));
  const payers = await payerStats(id, [...new Set([...open.map((i) => i.customerId), ...schedules.map((s) => s.customerId)])]);
  const lateDays = (customerId: string) => payers.get(customerId)?.avgDaysLate ?? 0;

  // ---- Money in: open invoices
  for (const inv of open) {
    const due = round2(balanceDue(inv) * inv.exchangeRate);
    if (due <= 0) continue;
    const promise = promises.filter((p) => p.invoiceId === inv.id).sort((a, b) => a.promisedFor.getTime() - b.promisedFor.getTime())[0];
    const late = lateDays(inv.customerId);
    const date = promise ? notBefore(promise.promisedFor) : notBefore(addDays(inv.dueDate, late));
    inflows.push({
      date, label: inv.customer.name, amount: due, kind: "INVOICE", href: `/app/invoices/${inv.id}`,
      sub: promise ? `${inv.number} · promised for ${formatDate(promise.promisedFor, { day: "numeric", month: "short" })}` : late > 0 ? `${inv.number} · due ${formatDate(inv.dueDate, { day: "numeric", month: "short" })}, client usually pays ${late}d late` : inv.number,
    });
  }

  // ---- Money in: recurring invoices still to be sent in the window
  for (const s of schedules) {
    const lines = s.items as unknown as LineInput[];
    const t = computeTotals(lines, s.discount, s.vatRate, s.whtRate);
    let run = new Date(s.nextRunAt);
    let runs = s.runs;
    for (let n = 0; n < 60 && run < to; n++) {
      if (s.maxRuns != null && runs >= s.maxRuns) break;
      if (s.endAt && run > s.endAt) break;
      const date = notBefore(addDays(run, s.dueInDays + lateDays(s.customerId)));
      if (date < to) inflows.push({ date, label: s.customer.name, sub: `${s.title} · recurring`, amount: round2(t.amountDue * s.exchangeRate), kind: "RECURRING_INVOICE", href: `/app/recurring/${s.id}`, estimate: true });
      runs++;
      run = advance(run, s.frequency);
    }
  }

  // ---- Money out: unpaid bills
  for (const b of bills) {
    outflows.push({ date: notBefore(b.dueDate ?? b.date), label: b.vendor || b.category, sub: "Bill", amount: b.amount, kind: "BILL", href: `/app/expenses/${b.id}` });
  }

  // ---- Money out: recurring costs (rent, subscriptions)
  for (const r of recurringCosts) {
    let d = new Date(r.nextRunAt);
    for (let n = 0; n < 60 && d < to; n++) {
      if (r.endAt && d > r.endAt) break;
      const pay = r.asBill ? addDays(d, r.dueInDays) : d;
      if (pay < to) outflows.push({ date: notBefore(pay), label: r.title, sub: r.asBill ? "Recurring bill" : "Recurring cost", amount: r.amount, kind: "RECURRING_COST", href: `/app/expenses/recurring/${r.id}`, estimate: true });
      d = advance(d, r.frequency);
    }
  }

  // ---- Money out: payroll and its remittances, month by month
  const filed = (kind: string, period: string) => taxes.some((t) => t.kind === kind && t.period === period && t.filed);
  for (let m = -1; m < 4; m++) {
    const period = periodOf(addMonths(today, m));
    const payDate = payDateFor(period, business.payDay);
    const run = runs.find((r) => r.period === period);
    // A past month nobody ran payroll for isn't money still to go out.
    if (!run && payDate < today) continue;
    // The run's own figures when it exists, otherwise an estimate from the team.
    const everyone = run ? run.items : team.length ? team.map((e) => computePay(e)) : [];
    if (!everyone.length) continue;
    const est = !run;
    const label = periodLabel(period);
    // Salaries: only the people not paid yet.
    const unpaid = run ? run.items.filter((i) => !i.paidAt) : everyone;
    const net = round2(unpaid.reduce((s, p) => s + p.net, 0));
    if (net > 0 && (payDate >= today || run)) {
      outflows.push({ date: notBefore(payDate), label: "Salaries", sub: `${label} take-home · ${unpaid.length} ${unpaid.length === 1 ? "person" : "people"}`, amount: net, kind: "PAYROLL", href: run ? `/app/payroll/runs/${run.id}` : "/app/payroll", estimate: est });
    }
    // Remittances are due the month after whoever was paid, so they count until marked as remitted on Taxes.
    const sum = (k: "paye" | "pensionEmployee" | "pensionEmployer" | "wht") => round2(everyone.reduce((s, p) => s + p[k], 0));
    const [y, mo] = period.split("-").map(Number);
    const pension = round2(sum("pensionEmployee") + sum("pensionEmployer"));
    if (sum("paye") > 0 && !filed("PAYE", period)) outflows.push({ date: notBefore(new Date(y, mo, TAX_DEADLINES.payeDay)), label: "PAYE", sub: `${label} · to the state tax office`, amount: sum("paye"), kind: "TAX", href: "/app/taxes", estimate: est });
    if (pension > 0 && !filed("PENSION", period)) outflows.push({ date: notBefore(addWorkingDays(payDate, TAX_DEADLINES.pensionWorkingDays)), label: "Pension", sub: `${label} · staff and company`, amount: pension, kind: "TAX", href: "/app/taxes", estimate: est });
    if (sum("wht") > 0 && !filed("WHT", period)) outflows.push({ date: notBefore(new Date(y, mo, TAX_DEADLINES.whtDay)), label: "Contractor WHT", sub: label, amount: sum("wht"), kind: "TAX", href: "/app/taxes", estimate: est });
  }

  // ---- Money out: salaries kept as ordinary expenses (no team set up in Payroll): the last three months'
  // monthly average, on pay day.
  if (!team.length && !runs.length && salaryExpenses.length) {
    const monthly = round2(salaryExpenses.reduce((s, e) => s + e.amount, 0) / 3);
    for (let m = 0; m < 4; m++) {
      const payDate = payDateFor(periodOf(addMonths(today, m)), business.payDay);
      if (payDate < today) continue;
      outflows.push({ date: payDate, label: "Salaries", sub: `${periodLabel(periodOf(payDate))} · average of salaries recorded as expenses`, amount: monthly, kind: "PAYROLL", href: "/app/payroll", estimate: true });
    }
  }

  // ---- Money out: VAT already worked out for past months and not yet filed
  for (const t of taxes) {
    if (t.filed || t.kind !== "VAT" || t.amount <= 0) continue;
    outflows.push({ date: notBefore(t.dueDate), label: "VAT", sub: t.title, amount: t.amount, kind: "TAX", href: "/app/taxes" });
  }

  // ---- Money out: everyday spending, at the last three months' weekly average (an estimate the owner can switch off)
  const everydayWeekly = round2(everydayExpenses.reduce((s, e) => s + e.amount, 0) / 13);
  if (opts.everyday && everydayWeekly > 0) {
    for (let w = 0; w < FORECAST_WEEKS; w++) outflows.push({ date: addDays(from, w * 7 + 4), label: "Everyday spending", sub: "Average of the last 3 months", amount: everydayWeekly, kind: "EVERYDAY", estimate: true });
  }

  // ---- Weeks
  const opening = business.cashBalance ?? 0;
  const weeks: Week[] = [];
  let balance = opening;
  for (let w = 0; w < FORECAST_WEEKS; w++) {
    const start = addDays(from, w * 7);
    const end = addDays(start, 7);
    const inW = inflows.filter((f) => f.date >= start && f.date < end).sort((a, b) => a.date.getTime() - b.date.getTime());
    const outW = outflows.filter((f) => f.date >= start && f.date < end).sort((a, b) => a.date.getTime() - b.date.getTime());
    const i = round2(inW.reduce((s, f) => s + f.amount, 0));
    const o = round2(outW.reduce((s, f) => s + f.amount, 0));
    const open_ = balance;
    balance = round2(balance + i - o);
    weeks.push({ start, end, inflows: inW, outflows: outW, in: i, out: o, net: round2(i - o), opening: open_, closing: balance });
  }
  const lowest = weeks.reduce((m, w) => (w.closing < m.closing ? w : m), weeks[0]);
  const firstShort = weeks.find((w) => w.closing < 0) ?? null;
  return {
    weeks, opening, hasBalance: business.cashBalance != null, balanceAt: business.cashBalanceAt,
    totalIn: round2(weeks.reduce((s, w) => s + w.in, 0)), totalOut: round2(weeks.reduce((s, w) => s + w.out, 0)),
    closing: balance, lowest, firstShort, everydayWeekly,
  };
}
