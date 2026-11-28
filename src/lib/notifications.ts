import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { NoticeKind } from "./notificationsPure";

type Db = Prisma.TransactionClient;

/** Tells one person that something happened. */
export async function notifyUser(userId: string, kind: NoticeKind, href: string, subject: string, db: Db = prisma) {
  await db.notification.create({ data: { userId, kind, href, subject: subject.slice(0, 200) } });
}

/** Tells the people on an order, except the one who did it. */
export async function notifyOrder(orderId: string, actorId: string, kind: NoticeKind, db: Db = prisma) {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { clientId: true, providerId: true, service: { select: { title: true } } } });
  if (!order) return;
  for (const userId of [order.clientId, order.providerId]) {
    if (userId !== actorId) await notifyUser(userId, kind, `/orders/${orderId}`, order.service.title, db);
  }
}

/** What the header shows: unread messages and unread notifications. */
export async function unreadCounts(userId: string) {
  const [messages, notices] = await Promise.all([
    prisma.message.count({ where: { readAt: null, senderId: { not: userId }, conversation: { OR: [{ userAId: userId }, { userBId: userId }] } } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { messages, notices };
}
