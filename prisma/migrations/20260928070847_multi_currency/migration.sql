-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "currency" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "RecurringSchedule" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN     "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1;

