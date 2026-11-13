import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyPassword, startSession } from "@/lib/auth";
import { clientIp, handle, ok, readJson, HttpError } from "@/lib/http";
import { loginSchema } from "@/lib/validators";
import { LIMITS, isLimited, recordFailure, resetLimit, retryAfterSeconds } from "@/lib/rateLimit";

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

// One message for a wrong password AND for a blocked attempt: the body never says which limit was hit,
// or that one was. Only the status (429) and Retry-After differ.
const BAD_LOGIN = "Email yoki parol notoʻgʻri.";

export const POST = handle(async (req) => {
  const input = loginSchema.parse(await readJson(req));

  const emailKey = `login:email:${input.email}`;
  const ipKey = `login:ip:${clientIp(req)}`;
  const blocked = [
    isLimited(emailKey, LIMITS.loginPerEmail.limit) ? emailKey : null,
    isLimited(ipKey, LIMITS.loginPerIp.limit) ? ipKey : null,
  ].filter((k): k is string => k !== null);
  if (blocked.length) {
    const retryAfter = Math.max(...blocked.map(retryAfterSeconds));
    throw new HttpError(429, BAD_LOGIN, undefined, { "Retry-After": String(retryAfter) });
  }

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    recordFailure(emailKey, LIMITS.loginPerEmail.windowMs);
    recordFailure(ipKey, LIMITS.loginPerIp.windowMs);
    throw new HttpError(401, BAD_LOGIN);
  }
  if (!user.isActive) throw new HttpError(403, "Bu hisob faolsizlantirilgan.");
  // A correct password clears that email's failures. The IP's count stays: one good login must not
  // reset an address that is guessing at many accounts.
  resetLimit(emailKey);

  await startSession({ id: user.id, role: user.role, name: user.name });
  return ok({ user: { id: user.id, name: user.name, role: user.role } });
});
