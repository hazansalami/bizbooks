import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { balanceDue, naira } from "@/lib/money";
import { obligationStatus, taxObligations } from "@/lib/taxes";
import { cn, startOfDay, timeAgo } from "@/lib/utils";
import { switchBusiness } from "@/app/actions/team";
import { logout } from "@/app/actions/auth";
import { Badge, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Your businesses", robots: { index: false } };

/** Everyone an accountant looks after, with what needs attention in each, one tap from their books. */
export default async function Accountant() {
  const user = await requireUser();
  const memberships = await db.membership.findMany({ where: { userId: user.id }, include: { business: true }, orderBy: { createdAt: "asc" } });
  const businesses = [...(user.ownBusiness ? [{ b: user.ownBusiness, own: true }] : []), ...memberships.map((m) => ({ b: m.business, own: false }))];
  if (!businesses.length) redirect("/onboarding");
  const ids = businesses.map((x) => x.b.id);
  const today = startOfDay(new Date());
  const [open, review] = await Promise.all([
    db.invoice.findMany({ where: { businessId: { in: ids }, kind: "INVOICE", status: { in: ["SENT", "PARTIAL"] } }, select: { businessId: true, total: true, whtAmount: true, amountPaid: true, exchangeRate: true, dueDate: true } }),
    db.bankTransaction.groupBy({ by: ["businessId"], where: { businessId: { in: ids }, status: "UNMATCHED" }, _count: true }),
  ]);
  const taxes = await Promise.all(businesses.map((x) => taxObligations(x.b, 3).catch(() => [])));
  const rows = businesses.map((x, i) => {
    const mine = open.filter((o) => o.businessId === x.b.id);
    return {
      ...x,
      owed: mine.reduce((s, o) => s + balanceDue(o) * o.exchangeRate, 0),
      overdue: mine.filter((o) => o.dueDate < today).length,
      taxesLate: taxes[i].filter((o) => obligationStatus(o) === "overdue").length,
      taxesSoon: taxes[i].filter((o) => obligationStatus(o) === "soon").length,
      toReview: review.find((r) => r.businessId === x.b.id)?._count ?? 0,
    };
  }).sort((a, b) => b.taxesLate - a.taxesLate || b.overdue - a.overdue);
  const current = user.business?.id;

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Logo href="/accountant" />
          <form action={logout}><button className="text-sm font-semibold text-muted hover:text-ink">Log out</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl sm:text-3xl">Your businesses</h1>
        <p className="mt-2 text-ink-soft">{rows.length} {rows.length === 1 ? "company" : "companies"}. Those with late taxes or overdue invoices come first.</p>
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <li key={r.b.id} className={cn("flex flex-col rounded-2xl border bg-paper p-5", r.b.id === current ? "border-brand" : "border-line")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{r.b.legalName || r.b.name}</p>
                  <p className="text-sm text-muted">{r.own ? "Your own business" : "Accountant access"} · active {timeAgo(r.b.lastActiveAt)}</p>
                </div>
                {r.b.id === current && <Badge tone="brand">Open now</Badge>}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted">Owed to them</dt><dd className="num font-semibold">{naira(Math.round(r.owed))}</dd></div>
                <div><dt className="text-muted">Overdue invoices</dt><dd className={cn("font-semibold", r.overdue > 0 && "text-danger")}>{r.overdue}</dd></div>
                <div><dt className="text-muted">Taxes</dt><dd className={cn("font-semibold", r.taxesLate > 0 && "text-danger")}>{r.taxesLate ? <span className="inline-flex items-center gap-1"><AlertTriangle className="size-4" aria-hidden />{r.taxesLate} late</span> : r.taxesSoon ? `${r.taxesSoon} due soon` : "Up to date"}</dd></div>
                <div><dt className="text-muted">Bank lines to review</dt><dd className="font-semibold">{r.toReview}</dd></div>
              </dl>
              <form action={switchBusiness} className="mt-5">
                <input type="hidden" name="businessId" value={r.b.id} />
                <button className={buttonClass(r.b.id === current ? "primary" : "secondary", "sm")}>Open books <ArrowRight className="size-4" aria-hidden /></button>
              </form>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
