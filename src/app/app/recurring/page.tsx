import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeTotals, money, type LineInput } from "@/lib/money";
import { FREE_RECURRING_LIMIT, FREQUENCIES } from "@/lib/constants";
import { isPro } from "@/lib/plan";
import { formatDate } from "@/lib/utils";
import { Badge, ButtonLink, EmptyState, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Recurring invoices" };

export default async function Recurring() {
  const { business } = await requireBusiness();
  const schedules = await db.recurringSchedule.findMany({ where: { businessId: business.id }, include: { customer: true }, orderBy: [{ status: "asc" }, { nextRunAt: "asc" }] });
  const active = schedules.filter((s) => s.status !== "ENDED").length;
  const pro = isPro(business);

  return (
    <>
      <PageHeader
        title="Recurring invoices"
        description="For customers you bill on a schedule: rent, retainers, subscriptions, school fees, supplies."
        actions={<ButtonLink href="/app/recurring/new">New recurring invoice</ButtonLink>}
      />
      {!pro && active >= FREE_RECURRING_LIMIT && (
        <Notice tone="sun" className="mb-4">
          You're using {active} of {FREE_RECURRING_LIMIT} recurring invoices on the Free plan. <Link href="/app/settings/billing" className="font-semibold underline">Upgrade to Pro</Link> for unlimited.
        </Notice>
      )}
      {schedules.length === 0 ? (
        <EmptyState icon={<CalendarClock className="size-6" aria-hidden />} title="Bill once, get paid every month" body="Set up an invoice that goes out on its own, weekly, monthly or yearly, with a one-tap payment link." action={<ButtonLink href="/app/recurring/new" size="lg">Set up a recurring invoice</ButtonLink>} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
          {schedules.map((s) => {
            const t = computeTotals(s.items as unknown as LineInput[], s.discount, s.vatRate, s.whtRate);
            return (
              <li key={s.id}>
                <Link href={`/app/recurring/${s.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-canvas sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.title}</p>
                    <p className="truncate text-sm text-muted">{s.customer.name} · {FREQUENCIES[s.frequency]}</p>
                  </div>
                  <div className="text-right">
                    <p className="num font-bold">{money(t.total, s.currency)}</p>
                    {s.status === "ACTIVE" ? <p className="text-xs text-muted">Next: {formatDate(s.nextRunAt)}</p> : <Badge tone={s.status === "PAUSED" ? "sun" : "neutral"}>{s.status === "PAUSED" ? "Paused" : "Ended"}</Badge>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
