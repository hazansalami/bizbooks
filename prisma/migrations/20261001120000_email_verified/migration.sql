-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- Backfill: anyone who has completed a password reset already proved they receive mail at their address.
UPDATE "User" SET "emailVerifiedAt" = "passwordChangedAt" WHERE "passwordChangedAt" IS NOT NULL;
