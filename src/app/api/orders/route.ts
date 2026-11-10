import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  serviceId: z.string().min(1),
  brief: z.string().trim().min(20, "Nima kerakligini yozing (kamida 20 ta belgi)").max(2000),
  eventDate: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.date({ invalid_type_error: "Sanani toʻgʻri kiriting" }).optional(),
  ),
});

export const POST = handle(async (req) => {
  const user = await requireRole("CLIENT");
  if (!rateLimit(`order:${user.id}`, 20, 60 * 60 * 1000)) {
    throw new HttpError(429, "Yaqinda juda koʻp buyurtma yaratdingiz. Keyinroq qayta urinib koʻring.");
  }
  const input = schema.parse(await readJson(req));

  if (input.eventDate) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (input.eventDate < today) throw new HttpError(400, "Tadbir sanasi oʻtib ketgan boʻlishi mumkin emas.", { field: "eventDate" });
  }

  const service = await prisma.service.findUnique({
    where: { id: input.serviceId },
    include: { profile: { include: { user: { select: { isActive: true } } } } },
  });
  if (!service || !service.isActive || service.profile.status !== "APPROVED" || !service.profile.user.isActive) {
    throw new HttpError(404, "Bu paket endi mavjud emas.");
  }

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        clientId: user.id,
        providerId: service.profile.userId,
        serviceId: service.id,
        brief: input.brief,
        eventDate: input.eventDate,
        agreedPrice: service.price,
        agreedDays: service.deliveryDays,
        revisionsAllowed: service.revisions,
      },
    });
    const conversation = await tx.conversation.create({
      data: { userAId: user.id, userBId: service.profile.userId, orderId: created.id },
    });
    await tx.message.create({
      data: { conversationId: conversation.id, senderId: user.id, body: `Yangi buyurtma soʻrovi:\n${input.brief}` },
    });
    return created;
  });

  await logAudit({ actorId: user.id, action: "ORDER_CREATED", entity: "Order", entityId: order.id, meta: { serviceId: service.id } });
  return ok({ order: { id: order.id, status: order.status } }, 201);
});
