import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, clientIp, handle, ok, readJson } from "@/lib/http";
import { createAcceptedAgreement } from "@/lib/placeOrder";
import { rateLimit } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";
import { parseAnswers } from "@/lib/serviceDetails";
import { notifyOrder } from "@/lib/notifications";

const schema = z.object({
  serviceId: z.string().min(1),
  brief: z.string().trim().min(20, "Nima kerakligini yozing (kamida 20 ta belgi)").max(2000),
  eventDate: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.date({ invalid_type_error: "Sanani toʻgʻri kiriting" }).optional(),
  ),
  // Answers to the package's own questions, in their order (checked against the package below).
  answers: z.array(z.string()).max(20).optional(),
  // Buy the package on its own terms (the client has read and accepted them). Without it the order is a request, and
  // the creator sends terms first.
  accept: z.literal(true).optional(),
  // The terms the buy page showed. The creator may have changed the package since: then nothing is bought.
  seen: z.object({ price: z.number(), deliveryDays: z.number(), revisions: z.number() }).optional(),
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
  const { seen } = input;
  if (input.accept && seen && (seen.price !== service.price || seen.deliveryDays !== service.deliveryDays || seen.revisions !== service.revisions)) {
    throw new HttpError(409, "Paket shartlari oʻzgargan. Sahifani yangilab, yangi shartlarni koʻrib chiqing.");
  }
  const answers = parseAnswers(service.questions ?? [], input.answers);

  const [client, provider] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: service.profile.userId }, select: { name: true } }),
  ]);
  const ip = clientIp(req);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        clientId: user.id,
        providerId: service.profile.userId,
        serviceId: service.id,
        brief: input.brief,
        eventDate: input.eventDate,
        answers: answers.length ? answers : undefined,
        agreedPrice: service.price,
        agreedDays: service.deliveryDays,
        revisionsAllowed: service.revisions,
        status: input.accept ? "AWAITING_PAYMENT" : "REQUESTED",
      },
    });
    if (input.accept) {
      // The terms are the package's: the creator offered them by publishing it, the client accepts them now.
      await createAcceptedAgreement(tx, {
        orderId: created.id, serviceTitle: service.title, clientName: client.name, providerName: provider.name,
        price: service.price, deliveryDays: service.deliveryDays, revisions: service.revisions, ip,
      });
    }
    const conversation = await tx.conversation.create({
      data: { userAId: user.id, userBId: service.profile.userId, orderId: created.id },
    });
    await notifyOrder(created.id, user.id, "order_new", tx);
    await tx.message.create({
      data: { conversationId: conversation.id, senderId: user.id, body: `${input.accept ? "Paketni sotib oldim" : "Yangi buyurtma soʻrovi"}:\n${input.brief}` },
    });
    return created;
  });

  await logAudit({ actorId: user.id, action: "ORDER_CREATED", entity: "Order", entityId: order.id, meta: { serviceId: service.id, bought: !!input.accept } });
  return ok({ order: { id: order.id, status: order.status } }, 201);
});
