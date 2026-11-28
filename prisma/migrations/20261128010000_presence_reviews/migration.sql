-- Additive only: when an account was last active, how many orders a creator has completed (with the past ones counted
-- once here), profile views, and a creator's one reply under a review.
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

ALTER TABLE "ProviderProfile" ADD COLUMN "completedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "ProviderProfile" p SET "completedCount" = (
  SELECT COUNT(*) FROM "Order" o WHERE o."providerId" = p."userId" AND o."status" = 'COMPLETED'
);

ALTER TABLE "Review" ADD COLUMN "reply" TEXT,
ADD COLUMN "repliedAt" TIMESTAMP(3);
