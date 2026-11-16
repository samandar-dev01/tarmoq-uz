import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { emailChangeSchema } from "@/lib/accountSchemas";
import { requireCurrentPassword } from "@/lib/accountGuard";
import { logAudit } from "@/lib/audit";
import { HttpError, handle, ok, readJson } from "@/lib/http";

const TAKEN = "Bu email bilan hisob allaqachon mavjud.";

/**
 * Changes the sign-in email. The current password must be right, and the new address must not belong to another account.
 *
 * There is NO verification step on purpose: this product sends no email at all (no provider is set up, and a password
 * cannot be reset by email either), so a confirmation link could not be delivered. The password check is what protects
 * the change, and the old and new address go into the audit log. If email is ever added, confirm the new address here first.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const input = emailChangeSchema.parse(await readJson(req));
  await requireCurrentPassword(user.id, input.currentPassword);

  if (input.email === user.email) throw new HttpError(400, "Bu allaqachon sizning emailingiz.", { field: "email" });
  if (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })) throw new HttpError(409, TAKEN, { field: "email" });

  try {
    await prisma.user.update({ where: { id: user.id }, data: { email: input.email } });
  } catch (e) {
    // Someone took the address between the check above and the save: the database's unique rule is the last word.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError(409, TAKEN, { field: "email" });
    throw e;
  }
  await logAudit({ actorId: user.id, action: "EMAIL_CHANGED", entity: "User", entityId: user.id, meta: { from: user.email, to: input.email } });
  return ok({ email: input.email });
});
