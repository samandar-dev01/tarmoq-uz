import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { logAudit } from "../audit";
import { postOrderMessage } from "../messaging";
import { markPaymentHeld } from "./escrow";

/**
 * Manual card transfer: the client sends the agreed amount to the owner's card and presses "I paid"; an admin checks
 * the bank app and confirms. The amount is always the order's agreed price, never anything the client sends.
 */

/** The stored receipt the client uploaded with "I paid". */
export type StoredReceipt = { key: string; name: string; type: string };

/**
 * The client says they paid, with a receipt. The payment waits for an admin. Safe to press twice:
 * a repeat returns `created: false` and the caller must discard the receipt it just stored.
 */
export async function submitManualPayment(orderId: string, clientId: string, receipt: StoredReceipt) {
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, clientId } });
      if (!order) throw new HttpError(404, "Buyurtma topilmadi.");
      if (order.status !== "AWAITING_PAYMENT") throw new HttpError(409, "Bu buyurtma hozir toʻlov kutmayapti.");
      if (!order.agreedPrice) throw new HttpError(409, "Bu buyurtma uchun hali narx kelishilmagan.");

      const waiting = await tx.payment.findFirst({ where: { orderId, status: "AWAITING_CONFIRMATION" } });
      if (waiting) return { payment: waiting, created: false };

      const data = {
        status: "AWAITING_CONFIRMATION" as const, provider: "manual", amount: order.agreedPrice,
        receiptKey: receipt.key, receiptName: receipt.name, receiptType: receipt.type,
      };
      const open = await tx.payment.findFirst({ where: { orderId, status: "REQUIRES_PAYMENT" } });
      const payment = open
        ? await tx.payment.update({ where: { id: open.id }, data })
        : await tx.payment.create({ data: { orderId, ...data } });
      return { payment, created: true };
    });
  } catch (e) {
    // Two presses at once: the unique index payment_one_awaiting_per_order lets one through. The other is a repeat.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const payment = await prisma.payment.findFirst({ where: { orderId, status: "AWAITING_CONFIRMATION" } });
      if (payment) return { payment, created: false };
    }
    throw e;
  }
}

/** An admin saw the money in the bank app: the payment is held and the order starts. */
export async function confirmManualPayment(paymentId: string, adminId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.provider !== "manual") throw new HttpError(404, "Toʻlov topilmadi.");

  await prisma.$transaction(async (tx) => {
    await markPaymentHeld(tx, { orderId: payment.orderId, paymentId, from: "AWAITING_CONFIRMATION" });
    await postOrderMessage(payment.orderId, adminId, "Administrator toʻlovni tasdiqladi. Ijodkor ishni boshlashi mumkin.", tx);
  });
  await logAudit({ actorId: adminId, action: "PAYMENT_CONFIRMED", entity: "Payment", entityId: paymentId, meta: { orderId: payment.orderId, amount: payment.amount, provider: "manual" } });
}

/** The money did not arrive. The payment fails and the order stays open, so the client can try again. */
export async function rejectManualPayment(paymentId: string, adminId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.provider !== "manual") throw new HttpError(404, "Toʻlov topilmadi.");

  await prisma.$transaction(async (tx) => {
    const failed = await tx.payment.updateMany({
      where: { id: paymentId, status: "AWAITING_CONFIRMATION" },
      data: { status: "FAILED", failureCode: "not_received" },
    });
    if (failed.count !== 1) throw new HttpError(409, "Bu toʻlov allaqachon koʻrib chiqilgan. Sahifani yangilang.");
    await postOrderMessage(payment.orderId, adminId, "Administrator toʻlovni topa olmadi. Oʻtkazmani tekshirib, qayta urinib koʻring.", tx);
  });
  await logAudit({ actorId: adminId, action: "PAYMENT_REJECTED", entity: "Payment", entityId: paymentId, meta: { orderId: payment.orderId, amount: payment.amount, provider: "manual" } });
}

/** An admin sent the creator's money by hand. */
export async function markPayoutPaid(payoutId: string, adminId: string) {
  const done = await prisma.payout.updateMany({
    where: { id: payoutId, status: "PENDING" },
    data: { status: "PAID", paidAt: new Date(), paidById: adminId },
  });
  if (done.count !== 1) throw new HttpError(409, "Bu pul allaqachon oʻtkazilgan deb belgilangan. Sahifani yangilang.");
  await logAudit({ actorId: adminId, action: "PAYOUT_PAID", entity: "Payout", entityId: payoutId });
}
