import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { getParticipantConversation, markRead } from "@/lib/messaging";
import { rateLimit } from "@/lib/rateLimit";

type Ctx = { params: { id: string } };
const sendSchema = z.object({ body: z.string().trim().min(1, "Xabar yozing").max(2000, "Xabar 2000 ta belgidan oshmasligi kerak") });

const select = { id: true, senderId: true, body: true, createdAt: true, readAt: true } as const;

/** Polling endpoint. Without ?after it returns the latest 50 messages; with it, only newer ones. */
export const GET = handle(async (req, { params }: Ctx) => {
  const user = await requireUser();
  await getParticipantConversation(params.id, user.id);
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
  await markRead(params.id, user.id);
  return ok({ messages });
});

export const POST = handle(async (req, { params }: Ctx) => {
  const user = await requireRole("CLIENT", "PROVIDER");
  const { body } = sendSchema.parse(await readJson(req));
  await getParticipantConversation(params.id, user.id);
  if (!rateLimit(`msg:${user.id}`, 30, 60 * 1000)) throw new HttpError(429, "Xabarlarni juda tez yuboryapsiz. Sal sekinroq.");
  const message = await prisma.message.create({ data: { conversationId: params.id, senderId: user.id, body }, select });
  return ok({ message }, 201);
});
