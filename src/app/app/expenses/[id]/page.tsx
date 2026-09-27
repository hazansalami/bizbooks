import { notFound, redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateInput } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { ExpenseForm } from "@/components/expense-form";

export const metadata = { title: "Edit expense" };

export default async function EditExpense({ params }: { params: Promise<{ id: string }> }) {
  const { business } = await requireBusiness();
  const { id } = await params;
  const e = await db.expense.findFirst({ where: { id, businessId: business.id } });
  if (!e) notFound();
  if (e.payRunId) redirect(`/app/payroll/runs/${e.payRunId}`);
  return (
    <>
      <PageHeader title={e.paid ? "Edit expense" : "Edit bill"} back={{ href: "/app/expenses", label: "Expenses" }} />
      <ExpenseForm
        vatRegistered={business.vatRegistered}
        initial={{ id: e.id, amount: String(e.amount), category: e.category, date: dateInput(e.date), vendor: e.vendor ?? "", note: e.note ?? "", vatAmount: e.vatAmount ? String(e.vatAmount) : "", method: e.method, receipt: e.receipt ?? "", paid: e.paid ? "yes" : "no", status: e.paid ? "paid" : "bill", dueDate: dateInput(e.dueDate) }}
      />
    </>
  );
}
