import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { recomputeRating } from "@/lib/reviews";
import { logAudit } from "@/lib/audit";

type Ctx = { params: { id: string } };
const schema = z.object({ hidden: z.boolean() });

export const PATCH = handle(async (req, { params }: Ctx) => {
  const admin = await requireRole("ADMIN");
  const { hidden } = schema.parse(await readJson(req));
  const review = await prisma.review.findUnique({ where: { id: params.id } });
  if (!review) throw new HttpError(404, "Sharh topilmadi.");

  await prisma.$transaction(async (tx) => {
    await tx.review.update({ where: { id: review.id }, data: { isHidden: hidden } });
    await recomputeRating(tx, review.providerUserId);
  });
  await logAudit({ actorId: admin.id, action: hidden ? "REVIEW_HIDDEN" : "REVIEW_RESTORED", entity: "Review", entityId: review.id });
  return ok({ hidden });
});
