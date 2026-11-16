import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyPassword, startSession } from "@/lib/auth";
import { clientIp, handle, ok, readJson, HttpError } from "@/lib/http";
import { wrongDoor, type Door } from "@/lib/authRole";
import { tk } from "@/i18n/dictionary";
import { loginSchema } from "@/lib/validators";
import { LIMITS, isLimited, recordFailure, resetLimit, retryAfterSeconds } from "@/lib/rateLimit";

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

// One message for a wrong password AND for a blocked attempt: the body never says which limit was hit,
// or that one was. Only the status (429) and Retry-After differ.
const BAD_LOGIN = tk("Email yoki parol notoʻgʻri.");

// Keyed by the door the account belongs at. Said only after the password was right, so it tells a stranger
// nothing about an account; a wrong password always gets BAD_LOGIN, at every door.
// (`tk` only marks these sentences for the translation check; `handle()` puts them into the reader's language.)
const WRONG_DOOR: Record<Door, string> = {
  provider: tk("Bu ijodkor hisobi. Ijodkorlar eshigidan kiring."),
  client: tk("Bu mijoz hisobi. Mijozlar eshigidan kiring."),
  admin: tk("Bu hisob uchun boshqa kirish sahifasi bor."),
};

export const POST = handle(async (req) => {
  const input = loginSchema.parse(await readJson(req));

  const ip = clientIp(req);
  const emailKey = `login:email:${input.email}`;
  const pairKey = `login:pair:${input.email}|${ip}`;
  const ipKey = `login:ip:${ip}`;
  const blocked = [
    isLimited(pairKey, LIMITS.loginPerPair.limit) ? pairKey : null,
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
    recordFailure(pairKey, LIMITS.loginPerPair.windowMs);
    recordFailure(emailKey, LIMITS.loginPerEmail.windowMs);
    recordFailure(ipKey, LIMITS.loginPerIp.windowMs);
    throw new HttpError(401, BAD_LOGIN);
  }
  if (!user.isActive) throw new HttpError(403, "Bu hisob faolsizlantirilgan.");
  // Right password, wrong door: no session, and the failure counters are neither raised nor cleared.
  const door = wrongDoor(input.role, user.role);
  if (door) throw new HttpError(403, WRONG_DOOR[door], { code: "WRONG_DOOR", door });
  // A correct password clears this address's failures for this email. The email-wide and address-wide counts
  // stay: one good login must not reset an attacker who is guessing from elsewhere or at many accounts.
  resetLimit(pairKey);

  await startSession({ id: user.id, role: user.role, name: user.name });
  return ok({ user: { id: user.id, name: user.name, role: user.role } });
});
