-- AlterTable
ALTER TABLE "PaymentAccount" ADD COLUMN     "pendingAccountName" TEXT,
ADD COLUMN     "pendingAccountNumber" TEXT,
ADD COLUMN     "pendingBankCode" TEXT,
ADD COLUMN     "pendingBankName" TEXT;

