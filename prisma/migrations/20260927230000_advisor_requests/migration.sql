-- CreateTable
CREATE TABLE "AdvisorRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "services" TEXT NOT NULL,
    "teamSize" TEXT,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'WEBSITE',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvisorRequest_status_createdAt_idx" ON "AdvisorRequest"("status", "createdAt");

