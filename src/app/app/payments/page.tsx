import Link from "next/link";
import { Wallet } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { naira } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Payments received" };

export default async function Payments() {
  const { business } = await requireBusiness();
  const payments = await db.payment.findMany({
    where: { businessId: business.id },
    include: { invoice: { include: { customer: true } } },
    orderBy: { paidAt: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader title="Payments received" description="Every naira that came in, from online payments, transfers, cash and POS." />
      {payments.length === 0 ? (
        <EmptyState icon={<Wallet className="size-6" aria-hidden />} title="No payments yet" body="Payments show up here when customers pay online, or when you record a transfer, cash or POS payment on an invoice." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
          {payments.map((p) => (
            <li key={p.id}>
              <Link href={p.invoiceId ? `/app/invoices/${p.invoiceId}` : "#"} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.invoice?.customer.name ?? "Payment"}</p>
                  <p className="text-sm text-muted">{formatDate(p.paidAt)}{p.invoice ? ` · ${p.invoice.number}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="num font-bold text-brand-deep">+{naira(p.amount)}</p>
                  <Badge tone={p.reference ? "brand" : "neutral"}>{PAYMENT_METHODS[p.method] ?? p.method}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
