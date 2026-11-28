import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, clientIp, handle, ok, readJson } from "@/lib/http";
import { logAudit } from "@/lib/audit";
import { notifyOrder, notifyUser } from "@/lib/notifications";
import { createAcceptedAgreement } from "@/lib/placeOrder";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({
  action: z.enum(["accept", "decline", "withdraw"]),
  // Needed to accept: the client has read the terms.
  accept: z.literal(true).optional(),
});

/** The client accepts or declines an offer; the creator may take it back. Accepting places the order, ready to be paid. */
export const POST = handle(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireRole("CLIENT", "PROVIDER");
  const input = schema.parse(await readJson(req));
  // Only the two people of the offer ever see it.
  const offer = await prisma.offer.findFirst({
    where: { id, OR: [{ clientId: user.id }, { providerId: user.id }] },
    include: { service: { include: { profile: { include: { user: { select: { name: true, isActive: true } } } } } } },
  });
  if (!offer) throw new HttpError(404, "Taklif topilmadi.");
  const mineToWithdraw = offer.providerId === user.id;
  if ((input.action === "withdraw") !== mineToWithdraw) throw new HttpError(403, "Buning uchun sizda ruxsat yoʻq.");
  if (input.action === "accept" && !input.accept) throw new HttpError(400, "Davom etish uchun shartlarni qabul qilishingiz kerak.");
  const ip = clientIp(req);

  const orderId = await prisma.$transaction(async (tx) => {
    const status = input.action === "accept" ? "ACCEPTED" : input.action === "decline" ? "DECLINED" : "WITHDRAWN";
    const claimed = await tx.offer.updateMany({ where: { id: offer.id, status: "PENDING" }, data: { status, resolvedAt: new Date() } });
    if (claimed.count !== 1) throw new HttpError(409, "Bu taklifga allaqachon javob berilgan.");
    if (input.action !== "accept") {
      if (input.action === "decline") await notifyUser(offer.providerId, "offer_answer", `/messages/${offer.conversationId}`, offer.service.title, tx);
      return null;
    }
    const { service } = offer;
    if (!service.isActive || service.profile.status !== "APPROVED" || !service.profile.user.isActive) throw new HttpError(404, "Bu paket endi mavjud emas.");
    const client = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true } });
    const order = await tx.order.create({
      data: {
        clientId: user.id, providerId: offer.providerId, serviceId: service.id, brief: offer.description,
        agreedPrice: offer.price, agreedDays: offer.deliveryDays, revisionsAllowed: offer.revisions, status: "AWAITING_PAYMENT",
      },
    });
    await createAcceptedAgreement(tx, {
      orderId: order.id, serviceTitle: service.title, clientName: client.name, providerName: service.profile.user.name,
      price: offer.price, deliveryDays: offer.deliveryDays, revisions: offer.revisions, notes: offer.description, ip,
    });
    const conversation = await tx.conversation.create({ data: { userAId: user.id, userBId: offer.providerId, orderId: order.id } });
    await tx.message.create({ data: { conversationId: conversation.id, senderId: user.id, body: `Taklifni qabul qildim:\n${offer.description}` } });
    await tx.offer.update({ where: { id: offer.id }, data: { orderId: order.id } });
    await notifyOrder(order.id, user.id, "order_new", tx);
    return order.id;
  });
  await logAudit({ actorId: user.id, action: "OFFER_ANSWERED", entity: "Offer", entityId: offer.id, meta: { action: input.action, orderId } });
  return ok({ orderId });
});
