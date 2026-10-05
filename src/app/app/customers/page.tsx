import Link from "next/link";
import { Search, Users } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAYER_LABELS, payerStats } from "@/lib/collections";
import { balanceDue, naira } from "@/lib/money";
import { initials } from "@/lib/utils";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Clients" };

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { business } = await requireBusiness();
  const { q = "" } = await searchParams;
  const customers = await db.customer.findMany({
    where: { businessId: business.id, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }] } : {}) },
    include: { invoices: { where: { kind: "INVOICE", status: { in: ["SENT", "PARTIAL"] } }, select: { total: true, whtAmount: true, amountPaid: true, exchangeRate: true } } },
    orderBy: { name: "asc" },
  });
  const total = await db.customer.count({ where: { businessId: business.id } });
  const payers = await payerStats(business.id, customers.map((c) => c.id));

  return (
    <>
      <PageHeader title="Clients" actions={<><ButtonLink href="/app/import" variant="secondary">Import</ButtonLink><ButtonLink href="/app/customers/new">Add client</ButtonLink></>} />
      {total === 0 ? (
        <EmptyState icon={<Users className="size-6" aria-hidden />} title="No clients yet" body="Add the companies you bill. You can also add them while creating an invoice." action={<ButtonLink href="/app/customers/new" size="lg">Add my first client</ButtonLink>} />
      ) : (
        <>
          <form className="relative mb-4 sm:w-72" role="search">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input name="q" defaultValue={q} placeholder="Name, phone or email" aria-label="Search customers" className="min-h-11 w-full rounded-full border border-line-strong bg-paper pl-9 pr-4 focus:border-brand focus:outline-none" />
          </form>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
            {customers.map((c) => {
              const owes = c.invoices.reduce((s, i) => s + balanceDue(i) * i.exchangeRate, 0);
              return (
                <li key={c.id}>
                  <Link href={`/app/customers/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas sm:px-5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-wash text-sm font-bold text-brand-deep">{initials(c.name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="truncate text-sm text-muted">{c.phone || c.email || "No contact details"}</p>
                      {(() => { const p = payers.get(c.id); return p && p.label !== "NEW" ? <Badge tone={PAYER_LABELS[p.label].tone}>{PAYER_LABELS[p.label].text}{p.avgDaysLate > 3 ? ` · ~${p.avgDaysLate}d` : ""}</Badge> : null; })()}
                    </div>
                    {owes > 0 && <p className="num text-right text-sm"><span className="block text-xs text-muted">Owes</span><span className="font-bold">{naira(owes)}</span></p>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
