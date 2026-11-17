import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { HttpError } from "./errors";

export async function postOrderMessage(orderId: string, senderId: string, body: string, db: Prisma.TransactionClient = prisma) {
  const conversation = await db.conversation.findUnique({ where: { orderId }, select: { id: true } });
  if (!conversation) return;
  await db.message.create({ data: { conversationId: conversation.id, senderId, body: body.slice(0, 2000) } });
}

export async function getParticipantConversation(conversationId: string, userId: string) {
  // Ownership is part of the query itself: a conversation the user is not in is never loaded.
  const c = await prisma.conversation.findFirst({
    where: { id: conversationId, OR: [{ userAId: userId }, { userBId: userId }] },
    include: { userA: { select: { id: true, name: true } }, userB: { select: { id: true, name: true } } },
  });
  if (!c) throw new HttpError(404, "Suhbat topilmadi.");
  const other = c.userAId === userId ? c.userB : c.userA;
  return { conversation: c, other };
}

/**
 * Only says whether this person is in the conversation (one cheap query, no names loaded). For the chat poll, which runs
 * every few seconds and does not need `getParticipantConversation`'s two user lookups. Same rule, same 404.
 */
export async function assertParticipant(conversationId: string, userId: string) {
  const c = await prisma.conversation.findFirst({
    where: { id: conversationId, OR: [{ userAId: userId }, { userBId: userId }] },
    select: { id: true },
  });
  if (!c) throw new HttpError(404, "Suhbat topilmadi.");
}

/** True when at least one of these messages came from the other person and has not been read yet. */
export function hasUnreadFromOthers(messages: { senderId: string; readAt: Date | null }[], userId: string): boolean {
  return messages.some((m) => m.senderId !== userId && m.readAt === null);
}

export async function listConversations(userId: string) {
  const where = { OR: [{ userAId: userId }, { userBId: userId }] };
  const [conversations, unread] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        userA: { select: { id: true, name: true } },
        userB: { select: { id: true, name: true } },
        order: { select: { id: true, service: { select: { title: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.message.groupBy({
      by: ["conversationId"],
      where: { conversation: where, senderId: { not: userId }, readAt: null },
      _count: { _all: true },
    }),
  ]);
  const unreadMap = new Map(unread.map((u) => [u.conversationId, u._count._all]));
  return conversations
    .map((c) => ({
      id: c.id,
      other: c.userAId === userId ? c.userB : c.userA,
      orderId: c.order?.id ?? null,
      orderTitle: c.order?.service.title ?? null,
      last: c.messages[0] ?? null,
      unread: unreadMap.get(c.id) ?? 0,
      sortKey: (c.messages[0]?.createdAt ?? c.createdAt).getTime(),
    }))
    .sort((a, b) => b.sortKey - a.sortKey);
}

export async function markRead(conversationId: string, userId: string) {
  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });
}
