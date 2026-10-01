import { toNgn } from "@/lib/currency";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, ExternalLink, Pencil, Trash2, XCircle, ArrowRightLeft } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { canPayOnline, emailDraft, loadFullInvoice, payUrl, publicInvoiceUrl, whatsappMessage } from "@/lib/invoices";
import { balanceDue, money, naira } from "@/lib/money";
import { INVOICE_STATUS, PAYMENT_METHODS } from "@/lib/constants";
import { daysBetween, formatDate, timeAgo, whatsappLink } from "@/lib/utils";
import { convertQuote, deleteDraft, deleteInvoice, deletePayment, duplicateInvoice, resolveClaim, voidInvoice } from "@/app/actions/invoices";
import { Badge, buttonClass, Notice, Panel } from "@/components/ui";
import { ConfirmButton, DoubleConfirmButton, PrintButton } from "@/components/form-bits";
import { InvoiceDocument } from "@/components/invoice-document";
import { RecordPayment, SharePanel } from "@/components/invoice-actions";

export const metadata = { title: "Invoice" };

const EVENT_LABELS: Record<string, string> = {
  CREATED: "Created", SENT: "Sent", VIEWED: "Opened by customer", REMINDER: "Reminder sent", PAYMENT: "Payment received",
  CLAIM: "Client says they paid", VOID: "Cancelled", CONVERTED: "Turned into invoice", ACCEPTED: "Accepted by client",
  IMPORTED: "Imported", UNAPPLIED: "Payment needs attention",
};

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ share?: string }> }) {
  const { business, user } = await requireBusiness();
  const { id } = await params;
  const { share } = await searchParams;
  const inv = await loadFullInvoice(id);
  if (!inv || inv.businessId !== business.id) notFound();
  const [payments, claims, events, deposits] = await Promise.all([
    db.payment.findMany({ where: { invoiceId: id }, orderBy: { paidAt: "desc" } }),
    db.paymentClaim.findMany({ where: { invoiceId: id, status: "PENDING" }, orderBy: { createdAt: "desc" } }),
    db.invoiceEvent.findMany({ where: { invoiceId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.invoice.findMany({ where: { depositForId: id }, select: { id: true, number: true, status: true, total: true } }),
  ]);

  const isQuote = inv.kind === "QUOTE";
  const due = balanceDue(inv);
  const open = ["SENT", "PARTIAL", "DRAFT"].includes(inv.status) && !isQuote;
  const late = open && inv.sentAt ? daysBetween(inv.dueDate, new Date()) : 0;
  const st = INVOICE_STATUS[inv.status] ?? INVOICE_STATUS.DRAFT;
  const shareKind = inv.sentAt && !isQuote ? "reminder" : "send";
  const editable = inv.amountPaid === 0 && !["VOID", "CONVERTED", "PAID"].includes(inv.status);

  return (
    <div className="space-y-5">
      <div className="no-print">
        <Link href={inv.kind === "QUOTE" ? "/app/quotes" : "/app/invoices"} className="mb-2 inline-flex min-h-9 items-center text-sm font-semibold text-muted hover:text-ink">← {inv.kind === "QUOTE" ? "Quotes" : "Invoices"}</Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl sm:text-3xl">
              {inv.number}
              {late > 0 ? <Badge tone="danger">{late} days overdue</Badge> : <Badge tone={st.tone}>{st.label}</Badge>}
            </h1>
            <p className="mt-1 text-muted">
              <Link href={`/app/customers/${inv.customerId}`} className="font-semibold text-ink hover:underline">{inv.customer.name}</Link>
              {" · "}{isQuote ? `valid until ${formatDate(inv.dueDate)}` : `due ${formatDate(inv.dueDate)}`}
              {inv.recurringId && <>{" · "}<Link href={`/app/recurring/${inv.recurringId}`} className="font-semibold text-brand hover:underline">Recurring</Link></>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted">{isQuote ? "Quote total" : inv.status === "PAID" ? "Paid in full" : "Still to pay"}</p>
            <p className="num text-3xl font-bold tracking-tight">{money(isQuote || inv.status === "PAID" ? inv.total : due, inv.currency)}</p>
          </div>
        </div>
      </div>

      {claims.map((c) => (
        <Panel key={c.id} className="no-print border-info/40 bg-info-wash/60 p-4">
          <p className="font-semibold text-info">{c.payerName} says they've sent <span className="num">{money(c.amount, inv.currency)}</span></p>
          <p className="text-sm text-ink-soft">{timeAgo(c.createdAt)}{c.note ? ` · “${c.note}”` : ""}. Check your bank app, then confirm.</p>
          <form action={resolveClaim} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="claimId" value={c.id} />
            <button name="decision" value="confirm" className={buttonClass("primary", "sm")}>Yes, I've received it</button>
            <button name="decision" value="reject" className={buttonClass("secondary", "sm")}>I can't see it</button>
          </form>
        </Panel>
      ))}

      {inv.status !== "VOID" && inv.status !== "CONVERTED" && inv.status !== "PAID" && (
        <div className="no-print">
          <SharePanel
            id={inv.id}
            kind={shareKind}
            highlight={share === "1"}
            whatsappHref={whatsappLink(inv.customer.phone, whatsappMessage(inv, shareKind))}
            email={{ to: inv.customer.email ?? "", ...emailDraft(inv, shareKind), copyTo: inv.business.email || user.email }}
            link={canPayOnline(inv) ? payUrl(inv.publicToken) : publicInvoiceUrl(inv.publicToken)}
            hasEmail={!!inv.customer.email}
            customerName={inv.customer.name}
          />
          {!canPayOnline(inv) && !isQuote && (
            <p className="mt-2 text-sm text-muted">
              Want a “Pay now” button on this invoice? <Link href="/app/settings/payments" className="font-semibold text-brand hover:underline">Connect Paystack or Flutterwave</Link>.
            </p>
          )}
        </div>
      )}

      {open && due > 0 && <div className="no-print"><RecordPayment id={inv.id} balance={due} currency={inv.currency} invoiceRate={inv.exchangeRate} /></div>}

      <div className="no-print flex flex-wrap gap-2">
        {isQuote && inv.status !== "CONVERTED" && inv.status !== "VOID" && (
          <form action={convertQuote}><input type="hidden" name="id" value={inv.id} />
            <button className={buttonClass("primary", "sm")}><ArrowRightLeft className="size-4" aria-hidden /> Turn into invoice</button>
          </form>
        )}
        {editable && <Link href={`/app/invoices/${inv.id}/edit`} className={buttonClass("secondary", "sm")}><Pencil className="size-4" aria-hidden /> Edit</Link>}
        <form action={duplicateInvoice}><input type="hidden" name="id" value={inv.id} />
          <button className={buttonClass("secondary", "sm")}><Copy className="size-4" aria-hidden /> Duplicate</button>
        </form>
        <a href={publicInvoiceUrl(inv.publicToken)} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}><ExternalLink className="size-4" aria-hidden /> See what customer sees</a>
        <PrintButton className={buttonClass("secondary", "sm")} />
        {inv.status === "DRAFT" && inv.amountPaid === 0 ? (
          <form action={deleteDraft}><input type="hidden" name="id" value={inv.id} />
            <ConfirmButton message="Delete this draft? This can't be undone." className={buttonClass("ghost", "sm", "text-danger")}><Trash2 className="size-4" aria-hidden /> Delete draft</ConfirmButton>
          </form>
        ) : inv.status !== "VOID" && inv.status !== "PAID" && inv.status !== "CONVERTED" ? (
          <form action={voidInvoice}><input type="hidden" name="id" value={inv.id} />
            <ConfirmButton message="Cancel this invoice? The customer will no longer be able to pay it." className={buttonClass("ghost", "sm", "text-danger")}><XCircle className="size-4" aria-hidden /> Cancel invoice</ConfirmButton>
          </form>
        ) : null}
        {!(inv.status === "DRAFT" && inv.amountPaid === 0) && (
          <form action={deleteInvoice}><input type="hidden" name="id" value={inv.id} />
            <DoubleConfirmButton
              messages={[
                `Permanently delete ${inv.number}? This can't be undone.`,
                ...(payments.length ? [`${inv.number} has ${payments.length === 1 ? "a payment" : `${payments.length} payments`} recorded (${money(inv.amountPaid, inv.currency)}). Deleting the invoice removes ${payments.length === 1 ? "it" : "them"} from your books too.${payments.some((p) => p.reference) ? " It was paid online: deleting doesn't refund the client, so refund in Paystack or Flutterwave first if you need to." : ""} Delete anyway?`] : []),
              ]}
              className={buttonClass("ghost", "sm", "text-danger")}
            ><Trash2 className="size-4" aria-hidden /> Delete invoice</DoubleConfirmButton>
          </form>
        )}
      </div>

      {inv.acceptedAt && (
        <Notice tone="brand" className="no-print" title={`Accepted by ${inv.acceptedBy ?? "the client"} on ${formatDate(inv.acceptedAt)}`}>
          {deposits.length > 0 && <>Deposit: {deposits.map((d) => <Link key={d.id} href={`/app/invoices/${d.id}`} className="font-semibold underline">{d.number} ({money(d.total, inv.currency)}, {INVOICE_STATUS[d.status]?.label.toLowerCase()})</Link>)}. It'll be credited when you turn this quote into an invoice.</>}
        </Notice>
      )}
      {inv.status === "VOID" && <Notice tone="sun" className="no-print">This invoice was cancelled. It stays in your records but can't be paid.</Notice>}

      <InvoiceDocument inv={inv} />

      <div className="no-print grid gap-5 md:grid-cols-2">
        <Panel className="p-5">
          <h2 className="text-lg">Payments</h2>
          {payments.length === 0 ? <p className="mt-2 text-muted">No payments yet.</p> : (
            <ul className="mt-2 divide-y divide-line">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1">
                    <p className="num font-semibold">{money(p.amount, inv.currency)}</p>{inv.currency !== "NGN" && <p className="num text-xs text-muted">≈ {naira(toNgn(p.amount, p.exchangeRate))} at ₦{p.exchangeRate.toLocaleString("en-NG")}</p>}
                    <p className="text-sm text-muted">{PAYMENT_METHODS[p.method] ?? p.method} · {formatDate(p.paidAt)}{p.note ? ` · ${p.note}` : ""}</p>
                  </div>
                  {!p.reference && (
                    <form action={deletePayment}><input type="hidden" name="paymentId" value={p.id} />
                      <ConfirmButton message="Remove this payment?" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-danger-wash hover:text-danger">
                        <Trash2 className="size-4" aria-label="Remove payment" />
                      </ConfirmButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="p-5">
          <h2 className="text-lg">History</h2>
          <ol className="mt-2 space-y-2.5">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden />
                <div><p className="font-medium">{EVENT_LABELS[e.type] ?? e.type}{e.note ? <span className="font-normal text-muted"> · {e.note}</span> : null}</p><p className="text-muted">{timeAgo(e.createdAt)}</p></div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
