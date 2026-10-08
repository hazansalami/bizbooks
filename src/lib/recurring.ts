import "server-only";
import { db } from "./db";
import { createInvoice, emailInvoice, loadFullInvoice } from "./invoices";
import { addDays, addMonths } from "./utils";
import type { LineInput } from "./money";

export function advance(date: Date, frequency: string) {
  switch (frequency) {
    case "WEEKLY": return addDays(date, 7);
    case "QUARTERLY": return addMonths(date, 3);
    case "YEARLY": return addMonths(date, 12);
    default: return addMonths(date, 1);
  }
}

/**
 * Create this period's invoice, email it if asked, and move the schedule on.
 * `backdated`: a period before today on a schedule set up with a past start date. The invoice keeps its
 * scheduled date, counts as issued (owed, in reports) and is not emailed: the client gets no backlog.
 */
export async function runSchedule(scheduleId: string, opts: { backdated?: boolean } = {}) {
  const s = await db.recurringSchedule.findUnique({ where: { id: scheduleId } });
  if (!s || s.status !== "ACTIVE") return null;
  const issueDate = opts.backdated ? s.nextRunAt : s.nextRunAt < new Date() ? new Date() : s.nextRunAt;
  const runs = s.runs + 1;
  const next = advance(s.nextRunAt, s.frequency);
  const ended = (s.maxRuns != null && runs >= s.maxRuns) || (s.endAt != null && next > s.endAt);
  const inv = await db.$transaction(async (tx) => {
    // Claim this period first. A second run racing this one (a cron retry, or "Send next now" during the
    // cron) waits on the row, then finds nextRunAt already moved on and stops without creating anything.
    const claimed = await tx.recurringSchedule.updateMany({
      where: { id: s.id, status: "ACTIVE", nextRunAt: s.nextRunAt },
      data: { runs, lastRunAt: new Date(), nextRunAt: next, status: ended ? "ENDED" : "ACTIVE" },
    });
    if (claimed.count !== 1) return null;
    return createInvoice({
      businessId: s.businessId, customerId: s.customerId, kind: "INVOICE", issueDate,
      dueDate: addDays(issueDate, s.dueInDays), lines: s.items as unknown as LineInput[],
      discount: s.discount, vatRate: s.vatRate, whtRate: s.whtRate, notes: s.notes, recurringId: s.id,
      currency: s.currency, exchangeRate: s.exchangeRate,
    }, tx);
  });
  if (!inv) return null;
  if (opts.backdated) {
    await db.invoice.update({
      where: { id: inv.id },
      data: { status: "SENT", sentAt: issueDate, events: { create: { type: "NOTE", note: "Created from a backdated recurring schedule (not emailed)" } } },
    });
    return inv;
  }
  if (s.autoSend) {
    const full = await loadFullInvoice(inv.id);
    if (full?.customer.email) await emailInvoice(full, "send");
  }
  return inv;
}
