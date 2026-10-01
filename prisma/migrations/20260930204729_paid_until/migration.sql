-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "paidUntil" TIMESTAMP(3);


-- Backfill: businesses that have paid keep branding off until the end of the time they paid for
-- (latest payment's start plus its months), never past their current Pro end date.
UPDATE "Business" b
SET "paidUntil" = LEAST(b."proUntil", paid.until)
FROM (
  SELECT "businessId", MAX("paidAt" + ("months" || ' months')::interval) AS until
  FROM "PlatformPayment"
  WHERE "status" = 'PAID' AND "paidAt" IS NOT NULL
  GROUP BY "businessId"
) paid
WHERE paid."businessId" = b."id" AND b."plan" = 'PRO' AND b."proUntil" IS NOT NULL;
