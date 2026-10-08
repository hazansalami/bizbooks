-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "lastDigestAt" TIMESTAMP(3),
ADD COLUMN     "weeklyDigest" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "statementToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_statementToken_key" ON "Customer"("statementToken");

