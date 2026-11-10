import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { assertTransition } from "../orderMachine";
import { logAudit } from "../audit";
import { computeFees, evaluateTestCard, type CardInput } from "./pure";

export function feePercent(): number {
  const n = Number(process.env.PLATFORM_FEE_PERCENT ?? 10);
  return Number.isFinite(n) && n >= 0 && n <= 50 ? n : 10;
}

/** Creates (or reuses) the payment attempt for an order. The amount always comes from the order, never from the client. */
export async function getOrCreateIntent(orderId: string, clientId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.clientId !== clientId) throw new HttpError(404, "Order not found.");
  if (order.status !== "AWAITING_PAYMENT") throw new HttpError(409, "This order is not waiting for payment.");
  if (!order.agreedPrice) throw new HttpError(409, "This order has no agreed price yet.");

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
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.clientId !== clientId) throw new HttpError(404, "Order not found.");
      if (order.status !== "AWAITING_PAYMENT") throw new HttpError(409, "This order is not waiting for payment.");
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment || payment.orderId !== orderId) throw new HttpError(404, "Payment not found.");
      if (payment.status !== "REQUIRES_PAYMENT") throw new HttpError(409, "This payment was already processed. Reload the page.");
      if (payment.amount !== order.agreedPrice) throw new HttpError(409, "The price changed. Reload the page.");

      if (evaluated.outcome === "declined") {
        await tx.payment.update({
          where: { id: paymentId },
          data: { status: "FAILED", failureCode: evaluated.failureCode, cardBrand: evaluated.brand, cardLast4: evaluated.last4 },
        });
        return { ok: false as const, code: evaluated.failureCode, message: evaluated.message };
      }

      const claimed = await tx.payment.updateMany({
        where: { id: paymentId, status: "REQUIRES_PAYMENT" },
        data: { status: "HELD", cardBrand: evaluated.brand, cardLast4: evaluated.last4 },
      });
      if (claimed.count !== 1) throw new HttpError(409, "This payment was already processed.");

      assertTransition("AWAITING_PAYMENT", "IN_PROGRESS", "system");
      const moved = await tx.order.updateMany({ where: { id: orderId, status: "AWAITING_PAYMENT" }, data: { status: "IN_PROGRESS" } });
      if (moved.count !== 1) throw new HttpError(409, "The order changed. Reload the page.");

      await tx.ledgerEntry.create({ data: { paymentId, type: "ESCROW_HOLD", amount: payment.amount } });
      return { ok: true as const };
    });
  } catch (e) {
    // Unique index payment_one_paid_per_order: a second successful payment for the same order is impossible.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError(409, "This order has already been paid.");
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

/** HELD -> RELEASED: provider payout + platform fee. Must run inside the caller's transaction. */
export async function releaseEscrow(tx: Prisma.TransactionClient, orderId: string) {
  const payment = await tx.payment.findFirst({ where: { orderId, status: "HELD" } });
  if (!payment) throw new HttpError(409, "There is no held payment to release.");
  const claimed = await tx.payment.updateMany({ where: { id: payment.id, status: "HELD" }, data: { status: "RELEASED" } });
  if (claimed.count !== 1) throw new HttpError(409, "The payment was already released.");
  const { fee, payout } = computeFees(payment.amount, feePercent());
  await tx.ledgerEntry.createMany({
    data: [
      { paymentId: payment.id, type: "PROVIDER_PAYOUT", amount: payout },
      { paymentId: payment.id, type: "PLATFORM_FEE", amount: fee },
    ],
  });
  return { paymentId: payment.id, amount: payment.amount, fee, payout };
}

/** HELD -> REFUNDED. Must run inside the caller's transaction. */
export async function refundEscrow(tx: Prisma.TransactionClient, orderId: string) {
  const payment = await tx.payment.findFirst({ where: { orderId, status: "HELD" } });
  if (!payment) throw new HttpError(409, "There is no held payment to refund.");
  const claimed = await tx.payment.updateMany({ where: { id: payment.id, status: "HELD" }, data: { status: "REFUNDED" } });
  if (claimed.count !== 1) throw new HttpError(409, "The payment was already processed.");
  await tx.ledgerEntry.create({ data: { paymentId: payment.id, type: "REFUND", amount: payment.amount } });
  return { paymentId: payment.id, amount: payment.amount };
}
