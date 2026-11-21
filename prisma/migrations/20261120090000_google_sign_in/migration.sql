-- "Continue with Google": an account can now be made and found through Google.
--
-- passwordHash becomes optional (an account made through Google has no password; the password login already treats a
-- missing hash as a wrong password), and googleSub keeps Google's own id for the person, one account per Google id.
-- Nothing existing changes: every current row keeps its password and gets a NULL googleSub.
-- The names follow Prisma's own pattern (<Table>_<column>_key), so `prisma migrate dev` sees schema.prisma and the
-- database as the same.

ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleSub" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleSub_key" ON "User"("googleSub");
