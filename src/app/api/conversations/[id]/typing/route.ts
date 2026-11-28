import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok } from "@/lib/http";
import { assertParticipant } from "@/lib/messaging";
import { rateLimit } from "@/lib/rateLimit";
import { noteTyping } from "@/lib/typing";

type Ctx = { params: Promise<{ id: string }> };

/** "I am typing" in this conversation; the other side sees it for a few seconds. */
export const POST = handle(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireRole("CLIENT", "PROVIDER");
  if (!rateLimit(`typing:${user.id}`, 60, 60 * 1000)) throw new HttpError(429, "Xabarlarni juda tez yuboryapsiz. Sal sekinroq.");
  await assertParticipant(id, user.id);
  noteTyping(id, user.id);
  return ok({ ok: true });
});
