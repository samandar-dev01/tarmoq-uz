import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { recomputeRating } from "@/lib/reviews";
import { logAudit } from "@/lib/audit";
import { invalidatePublicListing } from "@/lib/publicCache";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ hidden: z.boolean() });

export const PATCH = handle(async (req, ctx: Ctx) => {
  const params = await ctx.params;
  const admin = await requireRole("ADMIN");
  const { hidden } = schema.parse(await readJson(req));
  const review = await prisma.review.findUnique({ where: { id: params.id } });
  if (!review) throw new HttpError(404, "Sharh topilmadi.");

  await prisma.$transaction(async (tx) => {
    await tx.review.update({ where: { id: review.id }, data: { isHidden: hidden } });
    await recomputeRating(tx, review.providerUserId);
  });
  // The rating decides the order of the public lists.
  invalidatePublicListing();
  await logAudit({ actorId: admin.id, action: hidden ? "REVIEW_HIDDEN" : "REVIEW_RESTORED", entity: "Review", entityId: review.id });
  return ok({ hidden });
});
