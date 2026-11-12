import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { recomputeRating } from "@/lib/reviews";
import { logAudit } from "@/lib/audit";

type Ctx = { params: { id: string } };
const schema = z.object({
  rating: z.number({ required_error: "Bahoni tanlang", invalid_type_error: "Bahoni tanlang" }).int().min(1, "Bahoni tanlang").max(5),
  comment: z.string().trim().min(10, "Kamida 10 ta belgi yozing").max(1000),
});

export const POST = handle(async (req, { params }: Ctx) => {
  const user = await requireRole("CLIENT");
  const input = schema.parse(await readJson(req));

  const order = await prisma.order.findFirst({ where: { id: params.id, clientId: user.id } });
  if (!order) throw new HttpError(404, "Buyurtma topilmadi.");
  if (order.status !== "COMPLETED") throw new HttpError(409, "Sharhni buyurtma yakunlangandan keyin qoldirish mumkin.");

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
      throw new HttpError(409, "Siz bu buyurtmaga allaqachon sharh qoldirgansiz.");
    }
    throw e;
  }
});
