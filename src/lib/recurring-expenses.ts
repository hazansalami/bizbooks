import "server-only";
import { db } from "./db";
import { advance } from "./recurring";
import { addDays } from "./utils";

/** Log this period's expense and move the schedule on. Called by the daily job. */
export async function runRecurringExpense(id: string) {
  const r = await db.recurringExpense.findUnique({ where: { id } });
  if (!r || r.status !== "ACTIVE") return null;
  const next = advance(r.nextRunAt, r.frequency);
  const ended = r.endAt != null && next > r.endAt;
  const [expense] = await db.$transaction([
    db.expense.create({
      data: {
        businessId: r.businessId, date: r.nextRunAt, amount: r.amount, vatAmount: r.vatAmount, category: r.category,
        vendor: r.vendor, note: r.title, method: r.method, recurringExpenseId: r.id,
        // As a bill it waits in "Bills you owe" until someone pays it; otherwise it's logged as paid.
        paid: !r.asBill, dueDate: r.asBill ? addDays(r.nextRunAt, r.dueInDays) : null,
      },
    }),
    db.recurringExpense.update({ where: { id: r.id }, data: { nextRunAt: next, status: ended ? "ENDED" : "ACTIVE" } }),
  ]);
  return expense;
}
