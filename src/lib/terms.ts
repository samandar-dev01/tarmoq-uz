import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { HttpError } from "./errors";
import { logAudit } from "./audit";
import { postOrderMessage } from "./messaging";
import { assertTransition } from "./orderMachine";
import { lockOrder } from "./orderLock";
import { buildTermsText, hashTerms } from "./agreements";

// New versions of an order's terms. Either side may ask for a change until the money is on its way: the version carries
// the asker's acceptance and waits for the other's.

export const termsSchema = z.object({
  price: z.number({ required_error: "Narxni kiriting", invalid_type_error: "Narxni kiriting" }).int().min(20000, "Eng kam narx — 20 000 soʻm").max(50_000_000),
  deliveryDays: z.number({ required_error: "Kunlar sonini kiriting", invalid_type_error: "Kunlar sonini kiriting" }).int().min(1).max(60),
  revisions: z.number({ required_error: "Tuzatishlar sonini kiriting", invalid_type_error: "Tuzatishlar sonini kiriting" }).int().min(0).max(10),
  notes: z.string().trim().max(1000).optional(),
});

export type Side = "client" | "provider";

export async function proposeTerms({ orderId, userId, by, input, ip }: { orderId: string; userId: string; by: Side; input: z.infer<typeof termsSchema>; ip: string }) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...(by === "client" ? { clientId: userId } : { providerId: userId }) },
    include: { service: { select: { title: true } }, client: { select: { name: true } }, provider: { select: { name: true } } },
  });
  if (!order) throw new HttpError(404, "Buyurtma topilmadi.");
  // A creator may send the first terms of a request; either side may change terms that are waiting or not yet paid.
  const open = order.status === "AGREEMENT_PENDING" || order.status === "AWAITING_PAYMENT" || (order.status === "REQUESTED" && by === "provider");
  if (!open) throw new HttpError(409, "Bu buyurtma shartlarini endi oʻzgartirib boʻlmaydi.");
  if (order.status !== "AGREEMENT_PENDING") assertTransition(order.status, "AGREEMENT_PENDING", by);

  try {
    const agreement = await prisma.$transaction(async (tx) => {
      await lockOrder(tx, order.id);
      // A transfer an admin is checking was made for the present terms: they can not change under it.
      if ((await tx.payment.count({ where: { orderId: order.id, status: "AWAITING_CONFIRMATION" } })) > 0) {
        throw new HttpError(409, "Toʻlov tekshirilmoqda. Hozir shartlarni oʻzgartirib boʻlmaydi.");
      }
      const latest = await tx.agreement.findFirst({ where: { orderId: order.id }, orderBy: { version: "desc" } });
      const version = (latest?.version ?? 0) + 1;
      const termsText = buildTermsText({
        orderId: order.id, version, serviceTitle: order.service.title,
        clientName: order.client.name, providerName: order.provider.name,
        price: input.price, deliveryDays: input.deliveryDays, revisions: input.revisions,
        notes: input.notes,
      });
      const now = new Date();
      const created = await tx.agreement.create({
        data: {
          orderId: order.id, version, termsText, price: input.price, deliveryDays: input.deliveryDays,
          termsHash: hashTerms({ orderId: order.id, version, price: input.price, deliveryDays: input.deliveryDays, revisions: input.revisions, termsText }),
          ...(by === "provider" ? { providerAcceptedAt: now, providerAcceptedIp: ip } : { clientAcceptedAt: now, clientAcceptedIp: ip }),
        },
      });
      const moved = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: "AGREEMENT_PENDING", agreedPrice: input.price, agreedDays: input.deliveryDays, revisionsAllowed: input.revisions },
      });
      if (moved.count !== 1) throw new HttpError(409, "Buyurtma oʻzgargan. Sahifani yangilang.");
      await postOrderMessage(
        order.id, userId,
        by === "provider"
          ? `Shartlarni yubordim (${version}-versiya). Iltimos, buyurtma sahifasida koʻrib chiqib, qabul qiling.`
          : `Shartlarni oʻzgartirishni soʻrayman (${version}-versiya). Iltimos, buyurtma sahifasida koʻrib chiqing.`,
        tx,
        "terms",
      );
      return created;
    });
    await logAudit({ actorId: userId, action: "TERMS_PROPOSED", entity: "Agreement", entityId: agreement.id, meta: { version: agreement.version, termsHash: agreement.termsHash, by } });
    return agreement;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError(409, "Shartlar hozirgina yangilandi. Sahifani yangilang.");
    }
    throw e;
  }
}
