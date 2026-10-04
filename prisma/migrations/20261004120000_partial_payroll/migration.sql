-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "payItemId" TEXT;

-- AlterTable
ALTER TABLE "PayItem" ADD COLUMN     "paidAt" TIMESTAMP(3);

-- Backfill: everyone on a run already marked paid was paid when the run was.
UPDATE "PayItem" pi SET "paidAt" = pr."paidAt"
FROM "PayRun" pr
WHERE pi."payRunId" = pr."id" AND pr."status" = 'PAID' AND pr."paidAt" IS NOT NULL;
