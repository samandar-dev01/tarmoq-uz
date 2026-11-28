import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rateLimit";
import { notifyUser } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ reply: z.string().trim().min(2, "Javobni yozing").max(600, "Javob 600 ta belgidan oshmasin") });

/** A creator answers a review about their own work, once. */
export const POST = handle(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireRole("PROVIDER");
  if (!rateLimit(`reply:${user.id}`, 20, 60 * 60 * 1000)) throw new HttpError(429, "Urinishlar juda koʻp. Birozdan keyin qayta urinib koʻring.");
  const { reply } = schema.parse(await readJson(req));
  // Ownership, visibility and "not answered yet" are part of the write itself.
  const saved = await prisma.review.updateMany({ where: { id, providerUserId: user.id, isHidden: false, reply: null }, data: { reply, repliedAt: new Date() } });
  if (saved.count !== 1) {
    const mine = await prisma.review.findFirst({ where: { id, providerUserId: user.id, isHidden: false }, select: { id: true } });
    if (!mine) throw new HttpError(404, "Sharh topilmadi.");
    throw new HttpError(409, "Siz bu sharhga allaqachon javob bergansiz.");
  }
  const review = await prisma.review.findUnique({ where: { id }, select: { authorId: true, orderId: true } });
  if (review) await notifyUser(review.authorId, "reply", `/orders/${review.orderId}`, user.name);
  await logAudit({ actorId: user.id, action: "REVIEW_REPLIED", entity: "Review", entityId: id });
  return ok({ ok: true }, 201);
});
