import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { naira } from "@/lib/money";
import { dateInput, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { RecurringExpenseForm } from "@/components/recurring-expense-form";

export const metadata = { title: "Recurring expense" };

export default async function EditRecurringExpense({ params }: { params: Promise<{ id: string }> }) {
  const { business } = await requireBusiness();
  const { id } = await params;
  const r = await db.recurringExpense.findFirst({ where: { id, businessId: business.id }, include: { expenses: { orderBy: { date: "desc" }, take: 12 } } });
  if (!r) notFound();
  return (
    <>
      <PageHeader title={r.title} back={{ href: "/app/expenses/recurring", label: "Recurring expenses" }} />
      <RecurringExpenseForm
        vatRegistered={business.vatRegistered}
        initial={{
          id: r.id, title: r.title, amount: String(r.amount), category: r.category, vendor: r.vendor ?? "", vatAmount: r.vatAmount ? String(r.vatAmount) : "",
          method: r.method, frequency: r.frequency, nextRunAt: dateInput(r.nextRunAt), endAt: dateInput(r.endAt), asBill: r.asBill ? "on" : "", dueInDays: String(r.dueInDays),
        }}
      />
      {r.expenses.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-lg">Logged so far</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-paper">
            {r.expenses.map((e) => <li key={e.id} className="flex justify-between px-4 py-2.5 text-sm"><span>{formatDate(e.date)}</span><span className="num font-semibold">{naira(e.amount)}</span></li>)}
          </ul>
        </>
      )}
    </>
  );
}
