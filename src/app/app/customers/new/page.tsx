import { requireBusiness } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "@/components/customer-form";

export const metadata = { title: "Add client" };

export default async function NewCustomer({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await requireBusiness();
  const { next } = await searchParams;
  return (
    <>
      <PageHeader title="Add a client" back={{ href: "/app/customers", label: "Clients" }} />
      <CustomerForm next={next} />
    </>
  );
}
