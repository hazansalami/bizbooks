import "server-only";
import { db } from "./db";
import { addDays, daysBetween } from "./utils";

/*
  How each client actually pays, learned from your own history: how many days after the due date their
  invoices were fully paid. Used for the client "payment score", to warn before giving credit, and by the
  cash flow forecast to expect money when this client really pays, not when the invoice says.
*/

export type PayerLabel = "NEW" | "ON_TIME" | "A_LITTLE_LATE" | "LATE" | "VERY_LATE";
export type PayerStats = { customerId: string; paidCount: number; avgDaysLate: number; onTimeRate: number; label: PayerLabel };

export const PAYER_LABELS: Record<PayerLabel, { text: string; tone: "brand" | "sun" | "danger" | "neutral" | "info" }> = {
  NEW: { text: "Not enough history", tone: "neutral" },
  ON_TIME: { text: "Pays on time", tone: "brand" },
  A_LITTLE_LATE: { text: "Usually a little late", tone: "info" },
  LATE: { text: "Pays late", tone: "sun" },
  VERY_LATE: { text: "Pays very late", tone: "danger" },
};

/** Fewer paid invoices than this and we don't judge (one late invoice isn't a habit). */
const MIN_HISTORY = 2;
/** Only the last year counts: clients change. */
const LOOKBACK_DAYS = 365;

export function labelFor(paidCount: number, avgDaysLate: number): PayerLabel {
  if (paidCount < MIN_HISTORY) return "NEW";
  if (avgDaysLate <= 3) return "ON_TIME";
  if (avgDaysLate <= 14) return "A_LITTLE_LATE";
  if (avgDaysLate <= 45) return "LATE";
  return "VERY_LATE";
}

/** Payment behaviour for every client of a business (or just some), keyed by customer id. */
export async function payerStats(businessId: string, customerIds?: string[]) {
  const paid = await db.invoice.findMany({
    where: {
      businessId, kind: "INVOICE", status: "PAID", paidAt: { not: null, gte: addDays(new Date(), -LOOKBACK_DAYS) },
      ...(customerIds ? { customerId: { in: customerIds } } : {}),
    },
    select: { customerId: true, dueDate: true, paidAt: true },
  });
  const by = new Map<string, number[]>();
  for (const i of paid) (by.get(i.customerId) ?? by.set(i.customerId, []).get(i.customerId)!).push(Math.max(0, daysBetween(i.dueDate, i.paidAt!)));
  const out = new Map<string, PayerStats>();
  for (const [customerId, lates] of by) {
    const avg = Math.round(lates.reduce((s, d) => s + d, 0) / lates.length);
    const onTime = lates.filter((d) => d <= 3).length / lates.length;
    out.set(customerId, { customerId, paidCount: lates.length, avgDaysLate: avg, onTimeRate: onTime, label: labelFor(lates.length, avg) });
  }
  return out;
}

/** "Pays 18 days late on average (6 invoices)" */
export function payerSummary(s: PayerStats | undefined) {
  if (!s || s.label === "NEW") return "Not enough paid invoices yet to judge.";
  if (s.label === "ON_TIME") return `Pays on time (${s.paidCount} invoices, ${Math.round(s.onTimeRate * 100)}% on time).`;
  return `Pays ${s.avgDaysLate} day${s.avgDaysLate === 1 ? "" : "s"} late on average (${s.paidCount} invoices).`;
}
