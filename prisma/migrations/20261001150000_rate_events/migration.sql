-- CreateTable
CREATE TABLE "RateEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateEvent_kind_key_createdAt_idx" ON "RateEvent"("kind", "key", "createdAt");

-- CreateIndex
CREATE INDEX "RateEvent_createdAt_idx" ON "RateEvent"("createdAt");
