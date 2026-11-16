import { prisma } from "@/lib/db";
import { endOtherSessions, hashPassword, requireUser } from "@/lib/auth";
import { passwordSchema } from "@/lib/accountSchemas";
import { requireCurrentPassword } from "@/lib/accountGuard";
import { logAudit } from "@/lib/audit";
import { handle, ok, readJson } from "@/lib/http";

/**
 * Changes the password. The current one must be right (wrong answers are counted per person). Every other session of the
 * account ends (the token version is raised) and THIS browser gets a fresh cookie, so the person who just changed it stays
 * signed in. The new password follows the sign-up rules (8 to 72 characters).
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const input = passwordSchema.parse(await readJson(req));
  await requireCurrentPassword(user.id, input.currentPassword);

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
  await endOtherSessions(user.id);
  await logAudit({ actorId: user.id, action: "PASSWORD_CHANGED", entity: "User", entityId: user.id });
  return ok({ success: true });
});
