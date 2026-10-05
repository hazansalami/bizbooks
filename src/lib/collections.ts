import "server-only";
import { db } from "./db";
import { addDays, daysBetween, formatDate, greetingName } from "./utils";
import { balanceDue, money, round2 } from "./money";
import { emailInvoice, loadFullInvoice, payUrl, type FullInvoice } from "./invoices";
import { sendWhatsAppReminder, whatsappConfigured } from "./whatsapp";

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

/** WhatsApp reminder for an invoice, when the business has switched it on and WhatsApp is connected. */
export async function whatsappReminder(inv: FullInvoice & { business: { whatsappReminders: boolean } }) {
  if (!inv.business.whatsappReminders || !whatsappConfigured() || !inv.customer.phone) return false;
  const late = inv.dueDate < new Date();
  const r = await sendWhatsAppReminder(inv.customer.phone, [
    greetingName(inv.customer.name), inv.business.name, inv.number, money(balanceDue(inv), inv.currency),
    late ? `was due on ${formatDate(inv.dueDate)}` : `is due on ${formatDate(inv.dueDate)}`, payUrl(inv.publicToken),
  ]);
  if (r.ok) await db.invoiceEvent.create({ data: { invoiceId: inv.id, type: "REMINDER", note: "WhatsApp reminder sent" } });
  return r.ok;
}

/**
 * Daily: settle open promises. Kept when the promised amount (or the whole balance) has been paid since the
 * promise was made. Missed when the date has passed: the client gets a reminder that they promised, by
 * email and (if switched on) WhatsApp.
 */
export async function runPromiseChecks(now = new Date()) {
  const out = { kept: 0, missed: 0 };
  const open = await db.paymentPromise.findMany({ where: { status: "OPEN" }, include: { invoice: true }, take: 1000 });
  for (const p of open) {
    const paidSince = await db.payment.aggregate({ where: { invoiceId: p.invoiceId, paidAt: { gte: addDays(p.createdAt, -1) } }, _sum: { amount: true } });
    const kept = p.invoice.status === "PAID" || round2(paidSince._sum.amount ?? 0) >= p.amount - 0.005;
    if (kept) {
      await db.paymentPromise.update({ where: { id: p.id }, data: { status: "KEPT" } });
      out.kept++;
      continue;
    }
    // A day's grace: "Friday" means by the end of Friday.
    if (addDays(p.promisedFor, 1) > now || p.invoice.status === "VOID") {
      if (p.invoice.status === "VOID") await db.paymentPromise.update({ where: { id: p.id }, data: { status: "CANCELLED" } });
      continue;
    }
    await db.paymentPromise.update({ where: { id: p.id }, data: { status: "BROKEN", chasedAt: now } });
    await db.invoiceEvent.create({ data: { invoiceId: p.invoiceId, type: "PROMISE_BROKEN", note: `Promised ${money(p.amount, p.invoice.currency)} by ${formatDate(p.promisedFor)}` } });
    out.missed++;
    const full = await loadFullInvoice(p.invoiceId);
    if (!full) continue;
    const first = greetingName(full.customer.name);
    if (full.customer.email) {
      await emailInvoice(full, "reminder", {
        subject: `Payment for invoice ${full.number}`,
        message: `Hello ${first},\n\nOn ${formatDate(p.createdAt)} you let us know you'd pay ${money(p.amount, full.currency)} for invoice ${full.number} by ${formatDate(p.promisedFor)}. We haven't received it yet.\n\nYou can pay in one tap with the button below, or reply to let us know the new date.\n\nThank you,\n${full.business.name}`,
      }).catch(() => null);
    }
    await whatsappReminder(full).catch(() => false);
  }
  return out;
}
