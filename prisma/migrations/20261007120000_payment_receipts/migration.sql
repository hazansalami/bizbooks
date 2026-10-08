-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "receiptCounter" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "receiptNumber" TEXT,
ADD COLUMN     "receiptSentAt" TIMESTAMP(3),
ADD COLUMN     "receiptToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptToken_key" ON "Payment"("receiptToken");

