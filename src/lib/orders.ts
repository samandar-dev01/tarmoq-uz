import { prisma } from "./db";
import { HttpError } from "./errors";
import type { Actor } from "./orderMachine";

/** Loads an order only if the user is its client or provider; otherwise behaves as "not found". */
export async function getParticipantOrder(orderId: string, userId: string) {
  // Ownership is part of the query itself: a row that is not this user's is never loaded.
  const order = await prisma.order.findFirst({ where: { id: orderId, OR: [{ clientId: userId }, { providerId: userId }] } });
  if (!order) throw new HttpError(404, "Buyurtma topilmadi.");
  const actor: Actor = order.clientId === userId ? "client" : "provider";
  return { order, actor };
}
