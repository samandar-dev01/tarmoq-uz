import { prisma } from "@/lib/db";
import { verifyPassword, startSession } from "@/lib/auth";
import { clientIp, handle, ok, readJson, HttpError } from "@/lib/http";
import { wrongDoor } from "@/lib/authRole";
import { WRONG_DOOR } from "@/lib/doorMessages";
import { tk } from "@/i18n/dictionary";
import { loginSchema } from "@/lib/validators";
import { LIMITS, isLimited, recordFailure, resetLimit, retryAfterSeconds } from "@/lib/rateLimit";
import { totpMatches } from "@/lib/totp";
import { open } from "@/lib/secretBox";

// Compared against when the email is unknown, so response time does not reveal which emails exist: it is a real bcrypt hash
// at the same cost (12) as every stored password, so an unknown email takes as long as a wrong password.
// It is a constant on purpose. It used to be computed with `hashSync` when this file was first loaded, which froze the
// whole server for seconds on the free instance's slow CPU after every restart. It belongs to no account, and no login
// can succeed with it (`!user` fails first). If the cost of new passwords ever changes (src/lib/auth.ts), make a new one:
//   node -e 'console.log(require("bcryptjs").hashSync("not-a-real-password", <cost>))'
const DUMMY_HASH = "$2a$12$jgqqc9siV6AWg6MLBmARHOC/9DTuWpndocE6nuEaMRsuO1Tz1A0UW";

// One message for a wrong password AND for a blocked attempt: the body never says which limit was hit,
// or that one was. Only the status (429) and Retry-After differ.
const BAD_LOGIN = tk("Email yoki parol notoʻgʻri.");

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
  // Two-step sign-in: the right password is not enough. A wrong code counts like a wrong password.
  if (user.totpEnabledAt && user.totpSecretEnc) {
    if (!input.code) throw new HttpError(401, "Autentifikator ilovasidagi kodni kiriting.", { code: "NEED_CODE" });
    const codeKey = `login:code:${user.id}`;
    if (isLimited(codeKey, LIMITS.loginCodeFailures.limit)) {
      throw new HttpError(429, "Urinishlar juda koʻp. Birozdan keyin qayta urinib koʻring.", { code: "NEED_CODE" }, { "Retry-After": String(retryAfterSeconds(codeKey)) });
    }
    if (!totpMatches(open(user.totpSecretEnc, "totp"), input.code)) {
      recordFailure(pairKey, LIMITS.loginPerPair.windowMs);
      recordFailure(emailKey, LIMITS.loginPerEmail.windowMs);
      recordFailure(ipKey, LIMITS.loginPerIp.windowMs);
      recordFailure(codeKey, LIMITS.loginCodeFailures.windowMs);
      throw new HttpError(401, "Kod notoʻgʻri. Ilovadagi yangi kodni kiriting.", { code: "NEED_CODE" });
    }
    resetLimit(codeKey);
  }
  // A correct password clears this address's failures for this email. The email-wide and address-wide counts
  // stay: one good login must not reset an attacker who is guessing from elsewhere or at many accounts.
  resetLimit(pairKey);

  await startSession({ id: user.id, role: user.role, name: user.name, tokenVersion: user.tokenVersion });
  return ok({ user: { id: user.id, name: user.name, role: user.role } });
});
