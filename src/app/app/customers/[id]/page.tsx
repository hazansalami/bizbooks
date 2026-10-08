import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { balanceDue, money, naira } from "@/lib/money";
import { INVOICE_STATUS } from "@/lib/constants";
import { PAYER_LABELS, payerStats, payerSummary } from "@/lib/collections";
import { formatDate, greetingName, whatsappLink } from "@/lib/utils";
import { deleteCustomer } from "@/app/actions/customers";
import { Badge, ButtonLink, buttonClass, Notice, PageHeader, Panel, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/form-bits";
import { CustomerForm } from "@/components/customer-form";

export const metadata = { title: "Client" };

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string; error?: string }> }) {
  const { business } = await requireBusiness();
  const { id } = await params;
  const { edit, error } = await searchParams;
  const c = await db.customer.findFirst({
    where: { id, businessId: business.id },
    include: { invoices: { orderBy: { issueDate: "desc" } }, recurring: { where: { status: "ACTIVE" } } },
  });
  if (!c) notFound();

  if (edit) {
    return (
      <>
        <PageHeader title={`Edit ${c.name}`} back={{ href: `/app/customers/${id}`, label: c.name }} />
        <CustomerForm initial={{ id: c.id, name: c.name, contactName: c.contactName ?? "", email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", tin: c.tin ?? "", notes: c.notes ?? "" }} />
      </>
    );
  }

  const invoices = c.invoices.filter((i) => i.kind === "INVOICE" && i.status !== "VOID");
  const payer = (await payerStats(business.id, [c.id])).get(c.id);
  // Totals in naira, so a client billed in dollars adds up correctly.
  const owes = invoices.filter((i) => ["SENT", "PARTIAL"].includes(i.status)).reduce((s, i) => s + balanceDue(i) * i.exchangeRate, 0);
  const paid = invoices.reduce((s, i) => s + i.amountPaid * i.exchangeRate, 0);

  return (
    <>
      <PageHeader
        title={c.name}
        back={{ href: "/app/customers", label: "Clients" }}
        actions={<>
          <Link href={`/app/customers/${id}?edit=1`} className={buttonClass("secondary")}>Edit</Link>
          <Link href={`/app/customers/${id}/statement`} className={buttonClass("secondary")}>Statement</Link>
          <ButtonLink href={`/app/invoices/new?customer=${id}`}>New invoice</ButtonLink>
        </>}
      />
      {error === "has-invoices" && <Notice tone="sun" className="mb-4">This client has invoices, so they can't be deleted. Your records need them.</Notice>}
      {error === "has-recurring" && <Notice tone="sun" className="mb-4">This client has recurring invoices set up. End them under <Link href="/app/recurring" className="font-semibold underline">Recurring invoices</Link> first, then delete the client.</Notice>}
      <div className="mb-5 flex flex-wrap gap-2">
        {c.phone && <a href={whatsappLink(c.phone, `Hello ${greetingName(c.name)}, `)} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}><MessageCircle className="size-4" aria-hidden /> WhatsApp</a>}
        {c.phone && <a href={`tel:${c.phone}`} className={buttonClass("secondary", "sm")}><Phone className="size-4" aria-hidden /> Call</a>}
        {c.email && <a href={`mailto:${c.email}`} className={buttonClass("secondary", "sm")}><Mail className="size-4" aria-hidden /> {c.email}</a>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Owes you" value={naira(owes)} tone={owes > 0 ? "sun" : "neutral"} />
        <Stat label="Paid you in total" value={naira(paid)} tone="brand" />
        <Stat label="Payment habit" value={PAYER_LABELS[payer?.label ?? "NEW"].text} tone={payer?.label === "LATE" || payer?.label === "VERY_LATE" ? "danger" : payer?.label === "ON_TIME" ? "brand" : "neutral"} hint={payerSummary(payer)} />
      </div>
      {(payer?.label === "LATE" || payer?.label === "VERY_LATE") && (
        <p className="mt-3 text-sm text-ink-soft">Tip: ask this client for a deposit on new work, or put shorter payment terms on their invoices.</p>
      )}
      {c.recurring.length > 0 && (
        <p className="mt-4 text-sm text-muted">
          Billed automatically: {c.recurring.map((r) => <Link key={r.id} href={`/app/recurring/${r.id}`} className="font-semibold text-brand hover:underline">{r.title}</Link>)}
        </p>
      )}
      {c.notes && <Panel className="mt-4 p-4 text-sm"><p className="font-semibold">Notes</p><p className="whitespace-pre-line text-ink-soft">{c.notes}</p></Panel>}

      <h2 className="mb-3 mt-8 text-lg">Invoices and quotes</h2>
      {c.invoices.length === 0 ? <p className="text-muted">Nothing yet.</p> : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
          {c.invoices.map((inv) => {
            const st = INVOICE_STATUS[inv.status] ?? INVOICE_STATUS.DRAFT;
            return (
              <li key={inv.id}>
                <Link href={`/app/invoices/${inv.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-canvas">
                  <div><p className="font-semibold">{inv.number}{inv.kind === "QUOTE" && <span className="font-normal text-muted"> · quote</span>}</p><p className="text-sm text-muted">{formatDate(inv.issueDate)}</p></div>
                  <div className="text-right"><p className="num font-bold">{money(inv.total, inv.currency)}</p><Badge tone={st.tone}>{st.label}</Badge></div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {c.invoices.length === 0 && (
        <form action={deleteCustomer} className="mt-8">
          <input type="hidden" name="id" value={c.id} />
          <ConfirmButton message={`Delete ${c.name}?`} className={buttonClass("ghost", "sm", "text-danger")}>Delete client</ConfirmButton>
        </form>
      )}
    </>
  );
}
