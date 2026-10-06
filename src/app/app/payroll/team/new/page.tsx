import { requireBusiness } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { EmployeeForm } from "@/components/employee-form";

export const metadata = { title: "Add team member" };

export default async function NewEmployee() {
  const { user, business } = await requireBusiness();
  return (
    <>
      <PageHeader title="Add a team member" back={{ href: "/app/payroll/team", label: "Team" }} />
      <EmployeeForm payeDefault={business.payeDefault} canEditBank={user.role === "OWNER"} />
    </>
  );
}
