import { notFound, redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { isPro } from "@/lib/plan";
import { db } from "@/lib/db";
import { dateInput } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { InvoiceForm } from "@/components/invoice-form";

export const metadata = { title: "Edit invoice" };

export default async function EditInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { business } = await requireBusiness();
  const { id } = await params;
  const inv = await db.invoice.findFirst({ where: { id, businessId: business.id }, include: { items: { orderBy: { position: "asc" } } } });
  if (!inv) notFound();
  if (inv.amountPaid > 0 || inv.status === "VOID" || inv.status === "CONVERTED") redirect(`/app/invoices/${id}`);
  const [customers, items] = await Promise.all([
    db.customer.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" }, select: { id: true, name: true, phone: true } }),
    db.item.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" }, select: { name: true, unitPrice: true } }),
  ]);
  return (
    <>
      <PageHeader title={`Edit ${inv.number}`} back={{ href: `/app/invoices/${id}`, label: inv.number }} />
      <InvoiceForm
        kind={inv.kind as "INVOICE" | "QUOTE"}
        customers={customers}
        savedItems={items}
        vatRegistered={business.vatRegistered}
        vatRate={business.vatRate}
        termsDays={business.paymentTermsDays}
        pro={isPro(business)}
        initial={{
          id: inv.id, customerId: inv.customerId, issueDate: dateInput(inv.issueDate), dueDate: dateInput(inv.dueDate),
          discount: inv.discount, vatRate: inv.vatRate, whtRate: inv.whtRate, notes: inv.notes ?? "", poNumber: inv.poNumber ?? "", depositPercent: inv.depositPercent,
          items: inv.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
        }}
      />
    </>
  );
}
