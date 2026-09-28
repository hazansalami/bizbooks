import Link from "next/link";
import { FileText, Search } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { balanceDue, naira } from "@/lib/money";
import { INVOICE_STATUS } from "@/lib/constants";
import { cn, daysBetween, formatDate } from "@/lib/utils";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Invoices" };

const FILTERS = [
  ["all", "All"], ["unpaid", "Unpaid"], ["overdue", "Overdue"], ["paid", "Paid"], ["draft", "Drafts"],
] as const;

export default async function Invoices({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  const { business } = await requireBusiness();
  const { filter = "all", q = "" } = await searchParams;
  const now = new Date();
  const where: Prisma.InvoiceWhereInput = { businessId: business.id, kind: "INVOICE" };
  if (filter === "unpaid") where.status = { in: ["SENT", "PARTIAL"] };
  if (filter === "overdue") Object.assign(where, { status: { in: ["SENT", "PARTIAL"] }, dueDate: { lt: now } });
  if (filter === "paid") where.status = "PAID";
  if (filter === "draft") where.status = "DRAFT";
  if (q) where.OR = [{ number: { contains: q, mode: "insensitive" } }, { customer: { name: { contains: q, mode: "insensitive" } } }];

  const invoices = await db.invoice.findMany({ where, include: { customer: true }, orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }], take: 100 });
  const anyAtAll = invoices.length > 0 || (await db.invoice.count({ where: { businessId: business.id, kind: "INVOICE" } })) > 0;

  return (
    <>
      <PageHeader
        title="Invoices"
        actions={<>
          <ButtonLink href="/app/import" variant="secondary">Import</ButtonLink>
          <ButtonLink href="/app/invoices/new">New invoice</ButtonLink>
        </>}
      />
      {!anyAtAll ? (
        <EmptyState
          icon={<FileText className="size-6" aria-hidden />}
          title="No invoices yet"
          body="Bill a client in about a minute. They get a professional invoice by email with a secure “Pay now” link."
          action={<div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/app/invoices/new" size="lg">Create my first invoice</ButtonLink>
            <ButtonLink href="/app/import" size="lg" variant="secondary">Import from Wave or Zoho</ButtonLink>
          </div>}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <nav aria-label="Filter invoices" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:px-0">
              {FILTERS.map(([key, label]) => (
                <Link key={key} href={`/app/invoices?filter=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={filter === key ? "page" : undefined}
                  className={cn("inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold", filter === key ? "bg-ink text-white" : "bg-paper text-ink-soft ring-1 ring-line hover:ring-ink")}>
                  {label}
                </Link>
              ))}
            </nav>
            <form className="relative sm:w-64" role="search">
              <input type="hidden" name="filter" value={filter} />
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input name="q" defaultValue={q} placeholder="Customer or number" aria-label="Search invoices" className="min-h-10 w-full rounded-full border border-line-strong bg-paper pl-9 pr-4 text-sm focus:border-brand focus:outline-none" />
            </form>
          </div>

          {invoices.length === 0 ? (
            <p className="rounded-2xl border border-line bg-paper p-8 text-center text-muted">Nothing here. Try another filter.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
              {invoices.map((inv) => {
                const open = ["SENT", "PARTIAL"].includes(inv.status);
                const late = open ? daysBetween(inv.dueDate, now) : 0;
                const st = INVOICE_STATUS[inv.status] ?? INVOICE_STATUS.DRAFT;
                return (
                  <li key={inv.id}>
                    <Link href={`/app/invoices/${inv.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-canvas sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{inv.customer.name}</p>
                        <p className="text-sm text-muted">{inv.number} · {open ? `due ${formatDate(inv.dueDate)}` : formatDate(inv.issueDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="num font-bold">{naira(open ? balanceDue(inv) : inv.total)}</p>
                        {late > 0 ? <Badge tone="danger">{late}d overdue</Badge> : <Badge tone={st.tone}>{st.label}</Badge>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </>
  );
}
