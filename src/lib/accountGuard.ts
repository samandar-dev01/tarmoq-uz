import { prisma } from "./db";
import { HttpError } from "./http";
import { isLimited, LIMITS, rateLimit, recordFailure, resetLimit, retryAfterSeconds } from "./rateLimit";
import { verifyPassword } from "./auth";

/** Counts one use of an account action and refuses the request when the person has done it too often. */
export function limitAccountAction(action: "edit" | "avatar", userId: string) {
  const { limit, windowMs } = action === "avatar" ? LIMITS.avatarUpload : LIMITS.accountEdit;
  const key = `account:${action}:${userId}`;
  if (!rateLimit(key, limit, windowMs)) {
    throw new HttpError(429, "Juda koʻp urinish. Bir necha daqiqa kuting.", undefined, { "Retry-After": String(retryAfterSeconds(key)) });
  }
}

/**
 * For the actions that ask for the CURRENT password (a new password, a new email): the password must be right, and wrong
 * answers are counted per person (5 in 15 minutes), so a stolen session cannot be used to guess it. A right answer clears the count.
 * The answer to a wrong password is a field error on `currentPassword`, with the same 400 for every case, never a hint beyond it.
 */
export async function requireCurrentPassword(userId: string, password: string) {
  const key = `account:password:${userId}`;
  if (isLimited(key, LIMITS.accountPasswordFailures.limit)) {
    throw new HttpError(429, "Urinishlar juda koʻp. Birozdan keyin qayta urinib koʻring.", undefined, { "Retry-After": String(retryAfterSeconds(key)) });
  }
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    recordFailure(key, LIMITS.accountPasswordFailures.windowMs);
    throw new HttpError(400, "Joriy parol notoʻgʻri.", { field: "currentPassword" });
  }
  resetLimit(key);
}
