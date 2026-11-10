import { prisma } from "./db";
import { HttpError } from "./errors";
import type { Actor } from "./orderMachine";

/** Loads an order only if the user is its client or provider; otherwise behaves as "not found". */
export async function getParticipantOrder(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || (order.clientId !== userId && order.providerId !== userId)) {
    throw new HttpError(404, "Buyurtma topilmadi.");
  }
  const actor: Actor = order.clientId === userId ? "client" : "provider";
  return { order, actor };
}
