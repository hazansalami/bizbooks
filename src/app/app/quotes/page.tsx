import Link from "next/link";
import { FileSignature } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { money, naira } from "@/lib/money";
import { INVOICE_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Badge, ButtonLink, EmptyState, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Quotes" };

export default async function Quotes() {
  const { business } = await requireBusiness();
  const quotes = await db.invoice.findMany({ where: { businessId: business.id, kind: "QUOTE" }, include: { customer: true }, orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }], take: 200 });
  const open = quotes.filter((q) => q.status === "SENT");
  const won = quotes.filter((q) => ["ACCEPTED", "CONVERTED"].includes(q.status));
  const decided = quotes.filter((q) => ["ACCEPTED", "CONVERTED", "VOID"].includes(q.status)).length;

  return (
    <>
      <PageHeader
        title="Quotes"
        description="Price the project, let the client accept online (with a deposit if you want), then turn it into an invoice in one tap."
        actions={<ButtonLink href="/app/quotes/new">New quote</ButtonLink>}
      />
      {quotes.length === 0 ? (
        <EmptyState icon={<FileSignature className="size-6" aria-hidden />} title="Win the project before the work starts" body="Send a professional quote. Your client approves it online and, if you ask, pays a mobilisation deposit on the spot." action={<ButtonLink href="/app/quotes/new" size="lg">Create a quote</ButtonLink>} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Waiting on clients" value={naira(open.reduce((s, q) => s + q.total * q.exchangeRate, 0))} tone="sun" hint={`${open.length} open quote${open.length === 1 ? "" : "s"}`} />
            <Stat label="Won" value={naira(won.reduce((s, q) => s + q.total * q.exchangeRate, 0))} tone="brand" hint={decided ? `${Math.round((won.length / decided) * 100)}% win rate` : undefined} />
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
            {quotes.map((q) => {
              const st = INVOICE_STATUS[q.status] ?? INVOICE_STATUS.DRAFT;
              return (
                <li key={q.id}>
                  <Link href={`/app/invoices/${q.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-canvas sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{q.customer.name}</p>
                      <p className="text-sm text-muted">{q.number} · {q.status === "SENT" ? `valid until ${formatDate(q.dueDate)}` : formatDate(q.issueDate)}{q.depositPercent ? ` · ${q.depositPercent}% deposit` : ""}</p>
                    </div>
                    <div className="text-right"><p className="num font-bold">{money(q.total, q.currency)}</p><Badge tone={st.tone}>{q.status === "SENT" ? "Waiting" : st.label}</Badge></div>
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
