import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { profileSchema } from "@/lib/accountSchemas";
import { limitAccountAction } from "@/lib/accountGuard";
import { logAudit } from "@/lib/audit";
import { handle, ok, readJson } from "@/lib/http";

/**
 * The person changes their own name and phone. Whose account it is comes from the session, never from the request, and
 * nothing but these two fields is read from it: no role, no active flag, no email (that has its own route).
 * The creator's public address (the slug) is made once and does NOT follow the name.
 */
export const PATCH = handle(async (req) => {
  const user = await requireUser();
  limitAccountAction("edit", user.id);
  const input = profileSchema.parse(await readJson(req));

  const data: { name: string; phone?: string | null } = { name: input.name };
  if (input.phone !== undefined) data.phone = input.phone === "" ? null : input.phone;
  const saved = await prisma.user.update({ where: { id: user.id }, data, select: { name: true, phone: true } });

  const changed = [saved.name !== user.name && "name", saved.phone !== user.phone && "phone"].filter((f): f is string => !!f);
  if (changed.length) await logAudit({ actorId: user.id, action: "ACCOUNT_UPDATED", entity: "User", entityId: user.id, meta: { fields: changed } });
  return ok({ user: { name: saved.name, phone: saved.phone } });
});
