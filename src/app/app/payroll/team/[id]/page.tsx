import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateInput } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { EmployeeForm } from "@/components/employee-form";

export const metadata = { title: "Team member" };

export default async function EditEmployee({ params }: { params: Promise<{ id: string }> }) {
  const { business } = await requireBusiness();
  const { id } = await params;
  const e = await db.employee.findFirst({ where: { id, businessId: business.id } });
  if (!e) notFound();
  const s = (v: string | number | null | undefined) => (v == null ? "" : String(v));
  return (
    <>
      <PageHeader title={e.fullName} back={{ href: "/app/payroll/team", label: "Team" }} />
      <EmployeeForm
        initial={{
          id: e.id, kind: e.kind, fullName: e.fullName, jobTitle: s(e.jobTitle), email: s(e.email), phone: s(e.phone),
          monthlyGross: s(e.monthlyGross), annualRent: e.annualRent ? s(e.annualRent) : "", pension: e.pension ? "on" : "", paye: e.paye ? "on" : "", nhf: e.nhf ? "on" : "",
          pfa: s(e.pfa), pensionPin: s(e.pensionPin), whtRate: s(e.whtRate), bankName: s(e.bankName), accountNumber: s(e.accountNumber),
          accountName: s(e.accountName), startDate: dateInput(e.startDate),
        }}
      />
    </>
  );
}
