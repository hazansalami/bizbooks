import Link from "next/link";
import { Paperclip, Receipt, Repeat, Trash2 } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { naira } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { deleteExpense, markBillPaid } from "@/app/actions/expenses";
import { daysBetween } from "@/lib/utils";
import { buttonClass } from "@/components/ui";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { ExpenseTabs } from "@/components/expense-tabs";
import { ConfirmButton } from "@/components/form-bits";

export const metadata = { title: "Expenses" };

export default async function Expenses({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { business } = await requireBusiness();
  const bills = (await searchParams).filter === "bills";
  const unpaid = await db.expense.count({ where: { businessId: business.id, paid: false } });
  const expenses = await db.expense.findMany({
    where: { businessId: business.id, ...(bills ? { paid: false } : {}) },
    select: { id: true, date: true, amount: true, category: true, vendor: true, note: true, payRunId: true, recurringExpenseId: true, receipt: true, paid: true, dueDate: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 300,
  });
  const groups = new Map<string, { label: string; total: number; rows: typeof expenses }>();
  for (const e of expenses) {
    const key = `${e.date.getFullYear()}-${e.date.getMonth()}`;
    const g = groups.get(key) ?? { label: formatDate(e.date, { month: "long", year: "numeric" }), total: 0, rows: [] };
    g.total += e.amount;
    g.rows.push(e);
    groups.set(key, g);
  }

  return (
    <>
      <PageHeader title="Expenses" description="Everything the company spends. Payroll and recurring costs are added for you." actions={<ButtonLink href="/app/expenses/new">Add expense or bill</ButtonLink>} />
      <ExpenseTabs active={bills ? "bills" : "all"} unpaid={unpaid} />
      {expenses.length === 0 && bills ? (
        <EmptyState icon={<Receipt className="size-6" aria-hidden />} title="No unpaid bills" body="Record a supplier invoice as “Not paid yet” and it waits here, with its due date, until you pay it." />
      ) : expenses.length === 0 ? (
        <EmptyState icon={<Receipt className="size-6" aria-hidden />} title="No expenses yet" body="Software, rent, contractors, diesel… record them as they happen, or set regular costs to repeat automatically." action={<ButtonLink href="/app/expenses/new" size="lg">Add my first expense</ButtonLink>} />
      ) : (
        <div className="space-y-6">
          {[...groups.values()].map((g) => (
            <section key={g.label}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-base">{g.label}</h2>
                <p className="num text-sm font-semibold text-muted">{naira(g.total)}</p>
              </div>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
                {g.rows.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <Link href={e.payRunId ? `/app/payroll/runs/${e.payRunId}` : `/app/expenses/${e.id}`} className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate font-semibold">
                        {e.category}
                        {e.payRunId && <Badge tone="info">Payroll</Badge>}
                        {e.recurringExpenseId && <Repeat className="size-3.5 text-muted" aria-label="Recurring" />}
                        {e.receipt && <Paperclip className="size-3.5 text-muted" aria-label="Has receipt" />}
                        {!e.paid && <Badge tone={e.dueDate && daysBetween(e.dueDate, new Date()) > 0 ? "danger" : "sun"}>{e.dueDate ? `Due ${formatDate(e.dueDate, { day: "numeric", month: "short" })}` : "Unpaid"}</Badge>}
                      </p>
                      <p className="truncate text-sm text-muted">{formatDate(e.date)}{e.vendor ? ` · ${e.vendor}` : ""}{e.note ? ` · ${e.note}` : ""}</p>
                    </Link>
                    <p className="num font-bold">{naira(e.amount)}</p>
                    {!e.paid && (
                      <form action={markBillPaid}><input type="hidden" name="id" value={e.id} /><button className={buttonClass("secondary", "sm")}>Mark paid</button></form>
                    )}
                    {!e.payRunId && <form action={deleteExpense}>
                      <input type="hidden" name="id" value={e.id} />
                      <ConfirmButton message="Delete this expense?" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-danger-wash hover:text-danger">
                        <Trash2 className="size-4" aria-label="Delete expense" />
                      </ConfirmButton>
                    </form>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
