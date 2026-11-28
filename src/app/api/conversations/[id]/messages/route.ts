import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { assertParticipant, getParticipantConversation, hasUnreadFromOthers, lastSeenByOther, markRead } from "@/lib/messaging";
import { isOnline } from "@/lib/presence";
import { isTyping, stopTyping } from "@/lib/typing";
import { rateLimit } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ id: string }> };
const sendSchema = z.object({ body: z.string().trim().min(1, "Xabar yozing").max(2000, "Xabar 2000 ta belgidan oshmasligi kerak") });

const select = { id: true, senderId: true, body: true, createdAt: true, readAt: true } as const;

/** Polling endpoint. Without ?after it returns the latest 50 messages; with it, only newer ones. */
export const GET = handle(async (req, ctx: Ctx) => {
  const params = await ctx.params;
  const user = await requireUser();
  // This runs every few seconds per open chat, so it only checks membership and loads no names.
  const { other } = await assertParticipant(params.id, user.id);
  const after = new URL(req.url).searchParams.get("after");

  let messages;
  if (after) {
    const exists = await prisma.message.findFirst({ where: { id: after, conversationId: params.id }, select: { id: true } });
    if (!exists) throw new HttpError(400, "Notoʻgʻri soʻrov parametri.");
    messages = await prisma.message.findMany({
      where: { conversationId: params.id },
      cursor: { id: after },
      skip: 1,
      take: 100,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select,
    });
  } else {
    messages = (
      await prisma.message.findMany({ where: { conversationId: params.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50, select })
    ).reverse();
  }
  // Opening the chat (no `after`) marks everything unread, however old. A poll only writes when it brought something new
  // from the other person; an empty poll, the usual case, no longer runs an UPDATE.
  if (!after || hasUnreadFromOthers(messages, user.id)) await markRead(params.id, user.id);
  return ok({
    messages,
    presence: { online: isOnline(other.lastSeenAt), lastSeenAt: other.lastSeenAt },
    typing: isTyping(params.id, other.id),
    seenId: await lastSeenByOther(params.id, user.id),
  });
});

export const POST = handle(async (req, ctx: Ctx) => {
  const params = await ctx.params;
  const user = await requireRole("CLIENT", "PROVIDER");
  const { body } = sendSchema.parse(await readJson(req));
  await getParticipantConversation(params.id, user.id);
  if (!rateLimit(`msg:${user.id}`, 30, 60 * 1000)) throw new HttpError(429, "Xabarlarni juda tez yuboryapsiz. Sal sekinroq.");
  const message = await prisma.message.create({ data: { conversationId: params.id, senderId: user.id, body }, select });
  stopTyping(params.id, user.id);
  return ok({ message }, 201);
});
