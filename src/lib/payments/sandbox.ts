import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { logAudit } from "../audit";
import { evaluateTestCard, type CardInput } from "./pure";
import { markPaymentHeld } from "./escrow";
import { notifyOrder } from "../notifications";

/** Creates (or reuses) the payment attempt for an order. The amount always comes from the order, never from the client. */
export async function getOrCreateIntent(orderId: string, clientId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, clientId } });
  if (!order) throw new HttpError(404, "Buyurtma topilmadi.");
  if (order.status !== "AWAITING_PAYMENT") throw new HttpError(409, "Bu buyurtma hozir toʻlov kutmayapti.");
  if (!order.agreedPrice) throw new HttpError(409, "Bu buyurtma uchun hali narx kelishilmagan.");

  const existing = await prisma.payment.findFirst({ where: { orderId, status: "REQUIRES_PAYMENT" } });
  if (existing) {
    if (existing.amount === order.agreedPrice) return existing;
    return prisma.payment.update({ where: { id: existing.id }, data: { amount: order.agreedPrice } });
  }
  return prisma.payment.create({ data: { orderId, amount: order.agreedPrice } });
}

export type ConfirmResult = { ok: true } | { ok: false; code: string; message: string };

export async function confirmPayment(args: { orderId: string; paymentId: string; clientId: string; card: CardInput }): Promise<ConfirmResult> {
  const { orderId, paymentId, clientId, card } = args;
  const evaluated = evaluateTestCard(card);
  if (evaluated.outcome === "invalid") throw new HttpError(400, evaluated.message);

  let result: ConfirmResult;
  try {
    result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, clientId } });
      if (!order) throw new HttpError(404, "Buyurtma topilmadi.");
      if (order.status !== "AWAITING_PAYMENT") throw new HttpError(409, "Bu buyurtma hozir toʻlov kutmayapti.");
      const payment = await tx.payment.findFirst({ where: { id: paymentId, orderId } });
      if (!payment) throw new HttpError(404, "Toʻlov topilmadi.");
      if (payment.status !== "REQUIRES_PAYMENT") throw new HttpError(409, "Bu toʻlov allaqachon bajarilgan. Sahifani yangilang.");
      if (payment.amount !== order.agreedPrice) throw new HttpError(409, "Narx oʻzgargan. Sahifani yangilang.");

      if (evaluated.outcome === "declined") {
        await tx.payment.update({
          where: { id: paymentId },
          data: { status: "FAILED", failureCode: evaluated.failureCode, cardBrand: evaluated.brand, cardLast4: evaluated.last4 },
        });
        return { ok: false as const, code: evaluated.failureCode, message: evaluated.message };
      }

      await markPaymentHeld(tx, {
        orderId, paymentId, from: "REQUIRES_PAYMENT",
        data: { cardBrand: evaluated.brand, cardLast4: evaluated.last4 },
      });
      await notifyOrder(orderId, clientId, "payment", tx);
      return { ok: true as const };
    });
  } catch (e) {
    // Unique index payment_one_paid_per_order: a second successful payment for the same order is impossible.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError(409, "Bu buyurtma allaqachon toʻlangan.");
    }
    throw e;
  }

  await logAudit({
    actorId: clientId,
    action: result.ok ? "PAYMENT_HELD" : "PAYMENT_FAILED",
    entity: "Payment",
    entityId: paymentId,
    meta: { orderId, provider: "sandbox", last4: evaluated.last4, ...(result.ok ? {} : { code: result.code }) },
  });
  return result;
}
