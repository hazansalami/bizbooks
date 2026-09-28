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

/** Create this period's invoice, email it if asked, and move the schedule on. */
export async function runSchedule(scheduleId: string) {
  const s = await db.recurringSchedule.findUnique({ where: { id: scheduleId } });
  if (!s || s.status !== "ACTIVE") return null;
  const issueDate = s.nextRunAt < new Date() ? new Date() : s.nextRunAt;
  const inv = await db.$transaction(async (tx) => {
    const created = await createInvoice({
      businessId: s.businessId, customerId: s.customerId, kind: "INVOICE", issueDate,
      dueDate: addDays(issueDate, s.dueInDays), lines: s.items as unknown as LineInput[],
      discount: s.discount, vatRate: s.vatRate, whtRate: s.whtRate, notes: s.notes, recurringId: s.id,
      currency: s.currency, exchangeRate: s.exchangeRate,
    }, tx);
    const runs = s.runs + 1;
    const next = advance(s.nextRunAt, s.frequency);
    const ended = (s.maxRuns != null && runs >= s.maxRuns) || (s.endAt != null && next > s.endAt);
    await tx.recurringSchedule.update({
      where: { id: s.id },
      data: { runs, lastRunAt: new Date(), nextRunAt: next, status: ended ? "ENDED" : "ACTIVE" },
    });
    return created;
  });
  if (s.autoSend) {
    const full = await loadFullInvoice(inv.id);
    if (full?.customer.email) await emailInvoice(full, "send");
  }
  return inv;
}
