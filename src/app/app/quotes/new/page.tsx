import { requireBusiness } from "@/lib/auth";
import { isPro } from "@/lib/plan";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { InvoiceForm } from "@/components/invoice-form";

export const metadata = { title: "New quote" };

export default async function NewQuote({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { business } = await requireBusiness();
  const { customer } = await searchParams;
  const [customers, items] = await Promise.all([
    db.customer.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" }, select: { id: true, name: true, phone: true } }),
    db.item.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" }, select: { name: true, description: true, unitPrice: true } }),
  ]);
  return (
    <>
      <PageHeader title="New quote" back={{ href: "/app/quotes", label: "Quotes" }} description="Your client gets a link to review and accept it online." />
      <InvoiceForm
        kind="QUOTE"
        customers={customers}
        savedItems={items}
        vatRegistered={business.vatRegistered}
        vatRate={business.vatRate}
        termsDays={30}
        pro={isPro(business)}
        preselectCustomer={customers.some((c) => c.id === customer) ? customer : undefined}
      />
    </>
  );
}
