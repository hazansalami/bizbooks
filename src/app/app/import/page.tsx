import { requireBusiness } from "@/lib/auth";
import { isPro } from "@/lib/plan";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ImportWizard } from "@/components/import-wizard";

export const metadata = { title: "Import from Wave or Zoho Books" };

export default async function ImportPage() {
  const { business } = await requireBusiness();
  const [customers, invoices, liveSchedules] = await Promise.all([
    db.customer.findMany({ where: { businessId: business.id }, select: { name: true } }),
    db.invoice.findMany({ where: { businessId: business.id, kind: "INVOICE" }, select: { number: true } }),
    db.recurringSchedule.count({ where: { businessId: business.id, status: { in: ["ACTIVE", "PAUSED"] } } }),
  ]);
  return (
    <>
      <PageHeader
        title="Bring your books across"
        back={{ href: "/app/settings", label: "Settings" }}
        description="Import clients, invoices and services from Wave, Zoho Books or a spreadsheet. We read the file, show you everything first, and only save when you say so."
      />
      <ImportWizard
        existingCustomers={customers.map((c) => c.name)}
        existingNumbers={invoices.map((i) => i.number)}
        termsDays={business.paymentTermsDays}
        nextNumber={`${business.invoicePrefix}-${String(business.nextInvoiceNo).padStart(4, "0")}`}
        prefix={business.invoicePrefix}
        pro={isPro(business)}
        liveSchedules={liveSchedules}
      />
    </>
  );
}
