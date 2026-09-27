import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { RecurringForm } from "@/components/recurring-form";

export const metadata = { title: "New recurring invoice" };

export default async function NewRecurring({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { business } = await requireBusiness();
  const { customer } = await searchParams;
  const customers = await db.customer.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="New recurring invoice" back={{ href: "/app/recurring", label: "Recurring" }} />
      {customers.length === 0 ? (
        <EmptyState title="Add a customer first" body="Recurring invoices go to a saved customer." action={<ButtonLink href="/app/customers/new">Add a customer</ButtonLink>} />
      ) : (
        <RecurringForm customers={customers} vatRegistered={business.vatRegistered} vatRate={business.vatRate} termsDays={business.paymentTermsDays} preselectCustomer={customer} />
      )}
    </>
  );
}
