import { Prisma } from "@prisma/client";
import { HttpError } from "../errors";
import { assertTransition } from "../orderMachine";
import { platformFee } from "../fees";

/**
 * The escrow moves, shared by every way of paying (sandbox cards, manual card transfer, a real gateway later).
 * Each runs inside the caller's transaction. This file and `orderMachine.ts` are the only places that decide
 * how a payment and its order move together.
 */

/**
 * REQUIRES_PAYMENT or AWAITING_CONFIRMATION -> HELD, and the order AWAITING_PAYMENT -> IN_PROGRESS.
 * The amount is always checked against the agreed price on the order, never taken from the caller.
 */
export async function markPaymentHeld(
  tx: Prisma.TransactionClient,
  args: { orderId: string; paymentId: string; from: "REQUIRES_PAYMENT" | "AWAITING_CONFIRMATION"; data?: Prisma.PaymentUpdateManyMutationInput },
) {
  const { orderId, paymentId, from, data } = args;
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Buyurtma topilmadi.");
  if (order.status !== "AWAITING_PAYMENT") throw new HttpError(409, "Bu buyurtma hozir toʻlov kutmayapti.");
  const payment = await tx.payment.findFirst({ where: { id: paymentId, orderId } });
  if (!payment) throw new HttpError(404, "Toʻlov topilmadi.");
  if (payment.status !== from) throw new HttpError(409, "Bu toʻlov allaqachon bajarilgan. Sahifani yangilang.");
  if (payment.amount !== order.agreedPrice) throw new HttpError(409, "Narx oʻzgargan. Sahifani yangilang.");

  const claimed = await tx.payment.updateMany({ where: { id: paymentId, status: from }, data: { ...data, status: "HELD" } });
  if (claimed.count !== 1) throw new HttpError(409, "Bu toʻlov allaqachon bajarilgan.");

  assertTransition("AWAITING_PAYMENT", "IN_PROGRESS", "system");
  const moved = await tx.order.updateMany({ where: { id: orderId, status: "AWAITING_PAYMENT" }, data: { status: "IN_PROGRESS" } });
  if (moved.count !== 1) throw new HttpError(409, "Buyurtma oʻzgargan. Sahifani yangilang.");

  await tx.ledgerEntry.create({ data: { paymentId, type: "ESCROW_HOLD", amount: payment.amount } });
  return payment;
}

/**
 * HELD -> RELEASED: provider payout + platform fee.
 * For a real payment it also records the money owed to the creator as a PENDING payout, for an admin to send
 * and mark paid. Sandbox payments are not real money, so they never create one.
 */
export async function releaseEscrow(tx: Prisma.TransactionClient, orderId: string) {
  const payment = await tx.payment.findFirst({ where: { orderId, status: "HELD" } });
  if (!payment) throw new HttpError(409, "Oʻtkazish uchun ushlab turilgan toʻlov yoʻq.");
  const claimed = await tx.payment.updateMany({ where: { id: payment.id, status: "HELD" }, data: { status: "RELEASED" } });
  if (claimed.count !== 1) throw new HttpError(409, "Toʻlov allaqachon oʻtkazilgan.");
  const { fee, payout } = platformFee(payment.amount);
  await tx.ledgerEntry.createMany({
    data: [
      { paymentId: payment.id, type: "PROVIDER_PAYOUT", amount: payout },
      { paymentId: payment.id, type: "PLATFORM_FEE", amount: fee },
    ],
  });
  if (payment.provider !== "sandbox") {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { providerId: true } });
    await tx.payout.create({ data: { paymentId: payment.id, providerId: order.providerId, amount: payout } });
  }
  return { paymentId: payment.id, amount: payment.amount, fee, payout };
}

/** HELD -> REFUNDED. For a manual payment the admin must also send the money back by hand. */
export async function refundEscrow(tx: Prisma.TransactionClient, orderId: string) {
  const payment = await tx.payment.findFirst({ where: { orderId, status: "HELD" } });
  if (!payment) throw new HttpError(409, "Qaytarish uchun ushlab turilgan toʻlov yoʻq.");
  const claimed = await tx.payment.updateMany({ where: { id: payment.id, status: "HELD" }, data: { status: "REFUNDED" } });
  if (claimed.count !== 1) throw new HttpError(409, "Toʻlov allaqachon bajarilgan.");
  await tx.ledgerEntry.create({ data: { paymentId: payment.id, type: "REFUND", amount: payment.amount } });
  return { paymentId: payment.id, amount: payment.amount };
}
