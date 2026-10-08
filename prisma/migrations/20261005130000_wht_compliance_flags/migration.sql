-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "complianceTracking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whtTracking" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "whtChasedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WhtCredit" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "payerName" TEXT NOT NULL,
    "payerTin" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "source" TEXT NOT NULL DEFAULT 'TAXPROMAX',
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhtCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhtCredit_businessId_date_idx" ON "WhtCredit"("businessId", "date");

-- CreateIndex
CREATE INDEX "WhtCredit_invoiceId_idx" ON "WhtCredit"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "WhtCredit_businessId_source_reference_key" ON "WhtCredit"("businessId", "source", "reference");

-- AddForeignKey
ALTER TABLE "WhtCredit" ADD CONSTRAINT "WhtCredit_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

