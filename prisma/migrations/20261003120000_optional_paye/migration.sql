-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "payeDefault" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "paye" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "PayItem" ADD COLUMN     "payeByEmployee" BOOLEAN NOT NULL DEFAULT false;
