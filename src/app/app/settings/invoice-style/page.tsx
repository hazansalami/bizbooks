import Link from "next/link";
import { Check } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveInvoiceTemplate } from "@/app/actions/settings";
import { PageHeader } from "@/components/ui";
import { InvoiceDocument } from "@/components/invoice-document";
import { INVOICE_TEMPLATES, templateId, type InvoiceTemplateId } from "@/lib/invoice-templates";
import { addDays, cn } from "@/lib/utils";
import type { FullInvoice } from "@/lib/invoices";

export const metadata = { title: "Invoice style" };

export default async function InvoiceStyle({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { business } = await requireBusiness();
  const { view } = await searchParams;
  const current = templateId(business.invoiceTemplate);
  const viewing = templateId(view ?? current);
  const inv = await sampleInvoice(business.id);

  return (
    <>
      <PageHeader
        title="Invoice style"
        back={{ href: "/app/settings", label: "Settings" }}
        description="Choose how your invoices and quotes look. Every style uses your logo and brand colour, and prints cleanly to A4 PDF."
      />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {INVOICE_TEMPLATES.map((t) => (
          <li key={t.id} className={cn("flex flex-col rounded-2xl border bg-paper p-3", t.id === current ? "border-brand ring-2 ring-brand/30" : "border-line")}>
            <Link href={`?view=${t.id}#preview`} scroll={false} aria-label={`Preview the ${t.name} style`} className="block overflow-hidden rounded-xl border border-line bg-canvas">
              <Thumb inv={inv} template={t.id} />
            </Link>
            <div className="mt-3 flex flex-1 flex-col px-1">
              <p className="flex items-center gap-2 font-semibold">
                {t.name}
                {t.id === current && <span className="inline-flex items-center gap-1 rounded-full bg-brand-wash px-2 py-0.5 text-xs text-brand-deep"><Check className="size-3.5" aria-hidden /> In use</span>}
              </p>
              <p className="mt-1 flex-1 text-sm text-muted">{t.blurb}</p>
              <div className="mt-3 flex gap-2">
                {t.id !== current && (
                  <form action={saveInvoiceTemplate}>
                    <input type="hidden" name="template" value={t.id} />
                    <button className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep">Use this style</button>
                  </form>
                )}
                <Link href={`?view=${t.id}#preview`} scroll={false} className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-4 text-sm font-semibold hover:border-ink">Preview</Link>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <section id="preview" className="mt-10 scroll-mt-20">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">{INVOICE_TEMPLATES.find((t) => t.id === viewing)!.name} preview</h2>
          {viewing !== current && (
            <form action={saveInvoiceTemplate}>
              <input type="hidden" name="template" value={viewing} />
              <button className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep">Use this style</button>
            </form>
          )}
        </div>
        <p className="mb-4 text-sm text-muted">
          {inv.id === "sample" ? "Sample invoice with your business details." : `Showing your invoice ${inv.number}.`} Change your logo and colour in <Link href="/app/settings" className="font-semibold text-brand hover:underline">Settings</Link>.
        </p>
        <div className="mx-auto max-w-3xl"><InvoiceDocument inv={inv} template={viewing} /></div>
      </section>
    </>
  );
}

/** A real invoice scaled down, so the thumbnail is exactly what clients will see. */
function Thumb({ inv, template }: { inv: FullInvoice; template: InvoiceTemplateId }) {
  return (
    <div aria-hidden className="pointer-events-none relative h-80 overflow-hidden">
      <div className="absolute left-1/2 top-3 w-[760px] origin-top -translate-x-1/2 scale-[0.4]">
        <InvoiceDocument inv={inv} template={template} />
      </div>
    </div>
  );
}

/** The business's latest invoice with several lines, or a realistic sample built from its details. */
async function sampleInvoice(businessId: string): Promise<FullInvoice> {
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId }, include: { bankAccounts: true, gateways: true, paymentAccount: true } });
  const latest = await db.invoice.findFirst({
    where: { businessId, kind: "INVOICE", status: { not: "VOID" }, items: { some: {} } },
    orderBy: { createdAt: "desc" },
    include: { business: { include: { bankAccounts: true, gateways: true, paymentAccount: true } }, customer: true, items: { orderBy: { position: "asc" } } },
  });
  if (latest && latest.items.length >= 2) return latest;

  const issue = new Date();
  const items = [
    { description: "Website design upgrade", details: "Complete redesign of the company website.\n\nDeliverables:\n- Responsive layouts for mobile and desktop\n- CMS setup and content upload\n- Testing and launch", quantity: 1, unitPrice: 500000 },
    { description: "Website management", details: "Monthly updates, security monitoring and technical support for Sep 2026 – Aug 2027.", quantity: 12, unitPrice: 30000 },
    { description: "Hosting and domain renewal", details: "Domain renewal, hosting and SSL certificate installation.", quantity: 1, unitPrice: 136000 },
  ].map((l, i) => ({ id: `s${i}`, invoiceId: "sample", position: i, amount: l.quantity * l.unitPrice, ...l }));
  const subtotal = items.reduce((s, l) => s + l.amount, 0);
  const vatRate = business.vatRegistered ? business.vatRate : 0;
  const vatAmount = Math.round(subtotal * vatRate) / 100;
  return {
    id: "sample", businessId, business, customerId: "sample", kind: "INVOICE", number: `${business.invoicePrefix}-0042`,
    poNumber: "PO-7781", title: "Website redesign & renewal", summary: "Upgrade of the company website plus a year of management and hosting.",
    importSource: null, depositPercent: null, acceptedAt: null, acceptedBy: null, depositForId: null, status: "SENT",
    issueDate: issue, dueDate: addDays(issue, business.paymentTermsDays), currency: "NGN", exchangeRate: 1, subtotal, discount: 0, vatRate, vatAmount,
    whtRate: 0, whtAmount: 0, total: subtotal + vatAmount, amountPaid: 0, notes: null, publicToken: "sample",
    sentAt: issue, viewedAt: null, paidAt: null, lastReminderAt: null, whtChasedAt: null, reminderCount: 0, recurringId: null, convertedFromId: null,
    createdAt: issue, updatedAt: issue, items,
    customer: {
      id: "sample", businessId, name: "Arthur Group Ltd", contactName: "Head of Finance", email: "accounts@arthurgroup.ng", phone: null,
      address: "12 Adeola Odeku Street, Victoria Island, Lagos", tin: null, notes: null, currency: null, statementToken: null, createdAt: issue, updatedAt: issue,
    },
  };
}
