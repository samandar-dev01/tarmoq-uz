import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  serviceId: z.string().min(1),
  brief: z.string().trim().min(20, "Describe what you need (20+ characters)").max(2000),
  eventDate: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.date({ invalid_type_error: "Enter a valid date" }).optional(),
  ),
});

export const POST = handle(async (req) => {
  const user = await requireRole("CLIENT");
  if (!rateLimit(`order:${user.id}`, 20, 60 * 60 * 1000)) {
    throw new HttpError(429, "You have created many orders recently. Please try again later.");
  }
  const input = schema.parse(await readJson(req));

  if (input.eventDate) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (input.eventDate < today) throw new HttpError(400, "The event date cannot be in the past.", { field: "eventDate" });
  }

  const service = await prisma.service.findUnique({
    where: { id: input.serviceId },
    include: { profile: { include: { user: { select: { isActive: true } } } } },
  });
  if (!service || !service.isActive || service.profile.status !== "APPROVED" || !service.profile.user.isActive) {
    throw new HttpError(404, "This package is no longer available.");
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
      data: { conversationId: conversation.id, senderId: user.id, body: `New order request:\n${input.brief}` },
    });
    return created;
  });

  await logAudit({ actorId: user.id, action: "ORDER_CREATED", entity: "Order", entityId: order.id, meta: { serviceId: service.id } });
  return ok({ order: { id: order.id, status: order.status } }, 201);
});
