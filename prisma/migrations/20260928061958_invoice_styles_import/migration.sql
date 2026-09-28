-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "invoiceTemplate" TEXT NOT NULL DEFAULT 'classic';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "importSource" TEXT,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "details" TEXT;

