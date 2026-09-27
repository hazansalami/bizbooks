-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RecurringExpense" ADD COLUMN     "asBill" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dueInDays" INTEGER NOT NULL DEFAULT 0;

