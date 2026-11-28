import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { assertParticipant } from "@/lib/messaging";
import { formatUZS } from "@/lib/format";
import { rateLimit } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { termsSchema } from "@/lib/terms";

type Ctx = { params: Promise<{ id: string }> };
const schema = termsSchema.omit({ notes: true }).extend({
  serviceId: z.string({ required_error: "Paketni tanlang" }).min(1, "Paketni tanlang"),
  description: z.string().trim().min(10, "Taklifni yozing (kamida 10 ta belgi)").max(1000),
});
const MAX_OPEN = 3;

/** A creator sends their own terms to the client of this conversation. */
export const POST = handle(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireRole("PROVIDER");
  if (!rateLimit(`offer:${user.id}`, 20, 60 * 60 * 1000)) throw new HttpError(429, "Urinishlar juda koʻp. Birozdan keyin qayta urinib koʻring.");
  const input = schema.parse(await readJson(req));
  const { other } = await assertParticipant(id, user.id);
  const client = await prisma.user.findUnique({ where: { id: other.id }, select: { role: true, isActive: true } });
  if (!client || client.role !== "CLIENT" || !client.isActive) throw new HttpError(409, "Taklifni faqat mijozga yuborish mumkin.");
  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, isActive: true, profile: { userId: user.id, status: "APPROVED" } },
    select: { id: true, title: true },
  });
  if (!service) throw new HttpError(404, "Bu paket endi mavjud emas.");
  if ((await prisma.offer.count({ where: { conversationId: id, status: "PENDING" } })) >= MAX_OPEN) {
    throw new HttpError(409, "Javob kutayotgan takliflar koʻp. Avval ulardan birini qaytarib oling.");
  }

  const offer = await prisma.$transaction(async (tx) => {
    const created = await tx.offer.create({
      data: {
        conversationId: id, providerId: user.id, clientId: other.id, serviceId: service.id,
        description: input.description, price: input.price, deliveryDays: input.deliveryDays, revisions: input.revisions,
      },
    });
    await tx.message.create({ data: { conversationId: id, senderId: user.id, body: `Maxsus taklif yubordim: ${service.title}, ${formatUZS(input.price)}.` } });
    await notifyUser(other.id, "offer", `/messages/${id}`, service.title, tx);
    return created;
  });
  await logAudit({ actorId: user.id, action: "OFFER_SENT", entity: "Offer", entityId: offer.id });
  return ok({ offer: { id: offer.id } }, 201);
});
