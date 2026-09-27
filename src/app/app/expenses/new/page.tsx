import { requireBusiness } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ExpenseForm } from "@/components/expense-form";

export const metadata = { title: "Add expense" };

export default async function NewExpense() {
  const { business } = await requireBusiness();
  return (
    <>
      <PageHeader title="Add an expense" back={{ href: "/app/expenses", label: "Expenses" }} />
      <ExpenseForm vatRegistered={business.vatRegistered} />
    </>
  );
}
