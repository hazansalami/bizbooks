import { requireBusiness } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { RecurringExpenseForm } from "@/components/recurring-expense-form";

export const metadata = { title: "Add recurring expense" };

export default async function NewRecurringExpense() {
  const { business } = await requireBusiness();
  return (
    <>
      <PageHeader title="Add a recurring expense" back={{ href: "/app/expenses/recurring", label: "Recurring expenses" }} />
      <RecurringExpenseForm vatRegistered={business.vatRegistered} />
    </>
  );
}
