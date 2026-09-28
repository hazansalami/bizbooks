import { requireBusiness } from "@/lib/auth";
import { isPro } from "@/lib/plan";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { InvoiceForm } from "@/components/invoice-form";

export const metadata = { title: "New invoice" };

export default async function NewInvoice({ searchParams }: { searchParams: Promise<{ kind?: string; customer?: string }> }) {
  const { business } = await requireBusiness();
  const { kind, customer } = await searchParams;
  const isQuote = kind === "QUOTE";
  const [customers, items] = await Promise.all([
    db.customer.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" }, select: { id: true, name: true, phone: true } }),
    db.item.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" }, select: { name: true, description: true, unitPrice: true } }),
  ]);
  return (
    <>
      <PageHeader title={isQuote ? "New quote" : "New invoice"} back={{ href: "/app/invoices", label: "Invoices" }}
        description={isQuote ? "Send a price before the job. Turn it into an invoice with one tap when they agree." : undefined} />
      <InvoiceForm
        kind={isQuote ? "QUOTE" : "INVOICE"}
        customers={customers}
        savedItems={items}
        vatRegistered={business.vatRegistered}
        vatRate={business.vatRate}
        termsDays={business.paymentTermsDays}
        pro={isPro(business)}
        preselectCustomer={customers.some((c) => c.id === customer) ? customer : undefined}
      />
    </>
  );
}
