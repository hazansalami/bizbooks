import "server-only";
import { db } from "./db";
import { TAX_DEADLINES } from "./constants";
import { vatSummary } from "./reports";
import { periodLabel, periodOf } from "./payroll";
import { round2 } from "./money";
import { startOfDay } from "./utils";

export type Obligation = {
  kind: "VAT" | "PAYE" | "PENSION" | "WHT";
  period: string;
  title: string;
  who: string;
  amount: number;
  dueDate: Date;
  filed: boolean;
  filedAt?: Date;
};

/** Add n working days (Mon–Fri) to a date. Public holidays aren't counted, so treat it as a latest date. */
function addWorkingDays(d: Date, n: number) {
  const x = new Date(d);
  while (n > 0) {
    x.setDate(x.getDate() + 1);
    if (x.getDay() !== 0 && x.getDay() !== 6) n--;
  }
  return x;
}

/**
 * What the company owes the government for the last few months, and by when.
 * Amounts come from what's recorded: invoices paid (VAT), pay runs marked paid (PAYE, pension, contractor WHT).
 */
export async function taxObligations(business: { id: string; vatRegistered: boolean }, months = 3): Promise<Obligation[]> {
  const now = new Date();
  const [filings, runs] = await Promise.all([
    db.taxFiling.findMany({ where: { businessId: business.id } }),
    // Runs with anyone paid; amounts come from the people actually paid (a run can be paid in parts).
    db.payRun.findMany({ where: { businessId: business.id, status: { in: ["PAID", "PARTIAL"] } }, include: { items: { where: { paidAt: { not: null } } } }, orderBy: { period: "desc" }, take: months + 1 }),
  ]);
  const filed = (kind: string, period: string) => filings.find((f) => f.kind === kind && f.period === period);
  const out: Obligation[] = [];

  if (business.vatRegistered) {
    for (let i = 1; i <= months; i++) {
      const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const vat = await vatSummary(business.id, from, to);
      const period = periodOf(from);
      const f = filed("VAT", period);
      if (vat.net <= 0 && !f) continue;
      out.push({
        kind: "VAT", period, title: `VAT for ${periodLabel(period)}`, who: "Nigeria Revenue Service (NRS)",
        amount: vat.net, dueDate: new Date(to.getFullYear(), to.getMonth(), TAX_DEADLINES.vatDay), filed: !!f, filedAt: f?.paidAt,
      });
    }
  }

  for (const run of runs) {
    const sum = (k: "paye" | "pensionEmployee" | "pensionEmployer" | "wht") => round2(run.items.reduce((s, i) => s + i[k], 0));
    const r = { ...run, paye: sum("paye"), pensionEmployee: sum("pensionEmployee"), pensionEmployer: sum("pensionEmployer"), wht: sum("wht") };
    const [y, m] = r.period.split("-").map(Number);
    const add = (kind: Obligation["kind"], title: string, who: string, amount: number, dueDate: Date) => {
      if (amount <= 0) return;
      const f = filed(kind, r.period);
      out.push({ kind, period: r.period, title, who, amount: round2(amount), dueDate, filed: !!f, filedAt: f?.paidAt });
    };
    add("PAYE", `PAYE for ${periodLabel(r.period)}`, "Your state internal revenue service", r.paye, new Date(y, m, TAX_DEADLINES.payeDay));
    add("PENSION", `Pension for ${periodLabel(r.period)}`, "Each employee's pension fund administrator", r.pensionEmployee + r.pensionEmployer, addWorkingDays(r.payDate, TAX_DEADLINES.pensionWorkingDays));
    add("WHT", `Contractor WHT for ${periodLabel(r.period)}`, "Nigeria Revenue Service (NRS)", r.wht, new Date(y, m, TAX_DEADLINES.whtDay));
  }
  return out.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export function obligationStatus(o: Obligation, now = new Date()) {
  if (o.filed) return "filed" as const;
  const days = Math.round((startOfDay(o.dueDate).getTime() - startOfDay(now).getTime()) / 86400000);
  if (days < 0) return "overdue" as const;
  if (days <= 7) return "soon" as const;
  return "upcoming" as const;
}
