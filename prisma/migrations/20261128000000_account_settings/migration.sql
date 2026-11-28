-- Additive: the profile photo (a storage key and the time it last changed) and the session version.
-- tokenVersion starts at 0 for everyone, and a session cookie issued before this migration carries no version, which the app
-- reads as 0, so nobody is signed out by deploying it.
ALTER TABLE "User" ADD COLUMN "avatarKey" TEXT,
ADD COLUMN "avatarUpdatedAt" TIMESTAMP(3),
ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
