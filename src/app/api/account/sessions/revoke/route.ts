import { endOtherSessions, requireUser } from "@/lib/auth";
import { limitAccountAction } from "@/lib/accountGuard";
import { logAudit } from "@/lib/audit";
import { handle, ok } from "@/lib/http";

/** "Sign out everywhere": every other session of this account ends; this browser stays signed in (it gets a fresh cookie). */
export const POST = handle(async () => {
  const user = await requireUser();
  limitAccountAction("edit", user.id);
  await endOtherSessions();
  await logAudit({ actorId: user.id, action: "SESSIONS_REVOKED", entity: "User", entityId: user.id });
  return ok({ success: true });
});
