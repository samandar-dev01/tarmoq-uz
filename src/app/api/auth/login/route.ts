import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyPassword, startSession } from "@/lib/auth";
import { clientIp, handle, ok, readJson, HttpError } from "@/lib/http";
import { loginSchema } from "@/lib/validators";
import { isLimited, recordFailure, resetLimit } from "@/lib/rateLimit";

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

export const POST = handle(async (req) => {
  const input = loginSchema.parse(await readJson(req));

  const limitKey = `login:${clientIp(req)}:${input.email}`;
  if (isLimited(limitKey, 10)) {
    throw new HttpError(429, "Too many failed attempts. Please wait a few minutes and try again.");
  }

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    recordFailure(limitKey, 15 * 60 * 1000);
    throw new HttpError(401, "Invalid email or password.");
  }
  if (!user.isActive) throw new HttpError(403, "This account has been deactivated.");
  resetLimit(limitKey);

  await startSession({ id: user.id, role: user.role, name: user.name });
  return ok({ user: { id: user.id, name: user.name, role: user.role } });
});
