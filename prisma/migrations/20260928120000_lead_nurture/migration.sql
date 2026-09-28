-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "nextNurtureAt" TIMESTAMP(3),
ADD COLUMN     "nurtureStep" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "token" TEXT,
ADD COLUMN     "track" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "unsubscribedAt" TIMESTAMP(3);

-- Existing leads get a random unsubscribe token, then the column becomes required.
UPDATE "Lead" SET "token" = md5(random()::text || id) WHERE "token" IS NULL;
ALTER TABLE "Lead" ALTER COLUMN "token" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_token_key" ON "Lead"("token");

-- CreateIndex
CREATE INDEX "Lead_nextNurtureAt_idx" ON "Lead"("nextNurtureAt");
