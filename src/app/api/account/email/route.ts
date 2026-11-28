import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, whileSignedIn } from "@/lib/auth";
import { emailChangeSchema } from "@/lib/accountSchemas";
import { requireCurrentPassword } from "@/lib/accountGuard";
import { logAudit } from "@/lib/audit";
import { sendVerifyLink, unusedLinks } from "@/lib/authTokens";
import { mailEnabled } from "@/lib/mail";
import { HttpError, handle, ok, readJson } from "@/lib/http";

const TAKEN = "Bu email bilan hisob allaqachon mavjud.";

/**
 * Changes the sign-in email. The current password must be right, and the new address must not belong to another account.
 *
 * The password check is what protects the change, and the old and new address go into the audit log. Links sent to the
 * old address stop working. When the site can send email, the new address is asked to confirm itself.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const input = emailChangeSchema.parse(await readJson(req));
  await requireCurrentPassword(user.id, input.currentPassword);

  if (input.email === user.email) throw new HttpError(400, "Bu allaqachon sizning emailingiz.", { field: "email" });
  if (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })) throw new HttpError(409, TAKEN, { field: "email" });

  try {
    // A new address is not confirmed yet.
    await whileSignedIn(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { email: input.email, emailVerifiedAt: null } });
      await tx.authToken.deleteMany({ where: unusedLinks(user.id, "reset", "verify") });
    });
  } catch (e) {
    // Someone took the address between the check above and the save: the database's unique rule is the last word.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError(409, TAKEN, { field: "email" });
    throw e;
  }
  await logAudit({ actorId: user.id, action: "EMAIL_CHANGED", entity: "User", entityId: user.id, meta: { from: user.email, to: input.email } });
  if (mailEnabled()) void sendVerifyLink({ id: user.id, email: input.email }).catch((e) => console.error("Verification link failed:", e));
  return ok({ email: input.email });
});
