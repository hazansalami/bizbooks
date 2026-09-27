import Link from "next/link";
import { Repeat } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { naira } from "@/lib/money";
import { FREQUENCIES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { setRecurringExpenseStatus } from "@/app/actions/expenses";
import { Badge, ButtonLink, buttonClass, EmptyState, PageHeader, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/form-bits";
import { ExpenseTabs } from "@/components/expense-tabs";

export const metadata = { title: "Recurring expenses" };

const PER_MONTH: Record<string, number> = { WEEKLY: 52 / 12, MONTHLY: 1, QUARTERLY: 1 / 3, YEARLY: 1 / 12 };

export default async function RecurringExpenses() {
  const { business } = await requireBusiness();
  const items = await db.recurringExpense.findMany({ where: { businessId: business.id }, orderBy: [{ status: "asc" }, { nextRunAt: "asc" }] });
  const monthly = items.filter((i) => i.status === "ACTIVE").reduce((s, i) => s + i.amount * PER_MONTH[i.frequency], 0);
  return (
    <>
      <PageHeader title="Expenses" description="Fixed costs you set up once. BizBooks logs each one on its due date." actions={<ButtonLink href="/app/expenses/recurring/new">Add recurring expense</ButtonLink>} />
      <ExpenseTabs active="recurring" />
      {items.length === 0 ? (
        <EmptyState icon={<Repeat className="size-6" aria-hidden />} title="Stop typing the same costs every month" body="Office rent, software subscriptions, internet, diesel supply, retainers: add them once and they're recorded automatically." action={<ButtonLink href="/app/expenses/recurring/new" size="lg">Add a recurring expense</ButtonLink>} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-md"><Stat label="Fixed costs per month" value={naira(Math.round(monthly))} tone="sun" /><Stat label="Active" value={String(items.filter((i) => i.status === "ACTIVE").length)} /></div>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
            {items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <Link href={`/app/expenses/recurring/${r.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.title}</p>
                  <p className="truncate text-sm text-muted">{r.category} · {FREQUENCIES[r.frequency]}</p>
                </Link>
                <div className="text-right">
                  <p className="num font-bold">{naira(r.amount)}</p>
                  {r.status === "ACTIVE" ? <p className="text-xs text-muted">Next: {formatDate(r.nextRunAt)}</p> : <Badge tone={r.status === "PAUSED" ? "sun" : "neutral"}>{r.status === "PAUSED" ? "Paused" : "Ended"}</Badge>}
                </div>
                {r.status !== "ENDED" && (
                  <form action={setRecurringExpenseStatus} className="flex gap-1">
                    <input type="hidden" name="id" value={r.id} />
                    <button name="status" value={r.status === "ACTIVE" ? "PAUSED" : "ACTIVE"} className={buttonClass("ghost", "sm")}>{r.status === "ACTIVE" ? "Pause" : "Resume"}</button>
                    <ConfirmButton name="status" value="ENDED" message={`Stop “${r.title}”? Past entries stay in your books.`} className={buttonClass("ghost", "sm", "text-danger")}>End</ConfirmButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
