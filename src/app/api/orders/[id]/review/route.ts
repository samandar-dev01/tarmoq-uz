import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { recomputeRating } from "@/lib/reviews";
import { logAudit } from "@/lib/audit";

type Ctx = { params: { id: string } };
const schema = z.object({
  rating: z.number({ required_error: "Choose a rating", invalid_type_error: "Choose a rating" }).int().min(1, "Choose a rating").max(5),
  comment: z.string().trim().min(10, "Write at least 10 characters").max(1000),
});

export const POST = handle(async (req, { params }: Ctx) => {
  const user = await requireRole("CLIENT");
  const input = schema.parse(await readJson(req));

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order || order.clientId !== user.id) throw new HttpError(404, "Order not found.");
  if (order.status !== "COMPLETED") throw new HttpError(409, "You can review an order once it is completed.");

  try {
    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: { orderId: order.id, authorId: user.id, providerUserId: order.providerId, rating: input.rating, comment: input.comment },
      });
      await recomputeRating(tx, order.providerId);
      return created;
    });
    await logAudit({ actorId: user.id, action: "REVIEW_CREATED", entity: "Review", entityId: review.id });
    return ok({ review: { id: review.id } }, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError(409, "You have already reviewed this order.");
    }
    throw e;
  }
});
