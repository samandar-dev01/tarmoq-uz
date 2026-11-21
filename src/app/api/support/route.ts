import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { notifySupportMessage } from "@/lib/notify";
import { rateLimit } from "@/lib/rateLimit";
import { SUPPORT_MAX_CHARS, shouldAlert } from "@/lib/support";

const select = { id: true, fromStaff: true, body: true, createdAt: true } as const;
const sendSchema = z.object({
  body: z.string().trim().min(1, "Xabar yozing").max(SUPPORT_MAX_CHARS, `Xabar ${SUPPORT_MAX_CHARS} ta belgidan oshmasligi kerak`),
});

/**
 * The person's own thread with the support team. Without ?after it returns the latest 50 messages; with it, only newer
 * ones (the sheet polls this while it is open). Opening the thread (no `after`), or a poll that brings an answer, marks
 * the answers as read. Clients and creators only: admins answer from /admin/support.
 */
export const GET = handle(async (req) => {
  const user = await requireRole("CLIENT", "PROVIDER");
  const thread = await prisma.supportThread.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!thread) return ok({ messages: [] });

  const after = new URL(req.url).searchParams.get("after");
  let messages;
  if (after) {
    const exists = await prisma.supportMessage.findFirst({ where: { id: after, threadId: thread.id }, select: { id: true } });
    if (!exists) throw new HttpError(400, "Notoʻgʻri soʻrov parametri.");
    messages = await prisma.supportMessage.findMany({
      where: { threadId: thread.id },
      cursor: { id: after },
      skip: 1,
      take: 100,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select,
    });
  } else {
    messages = (
      await prisma.supportMessage.findMany({ where: { threadId: thread.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50, select })
    ).reverse();
  }
  // Only write when there is something new to mark: an empty poll, the usual case, runs no UPDATE.
  if (!after || messages.some((m) => m.fromStaff)) {
    await prisma.supportThread.update({ where: { id: thread.id }, data: { userReadAt: new Date() } });
  }
  return ok({ messages });
});

/** The person writes to the support team. The owner gets one Telegram ping per thread per 10 minutes (who, never what). */
export const POST = handle(async (req) => {
  const user = await requireRole("CLIENT", "PROVIDER");
  const { body } = sendSchema.parse(await readJson(req));
  if (!rateLimit(`support:${user.id}`, 20, 10 * 60 * 1000)) throw new HttpError(429, "Xabarlarni juda tez yuboryapsiz. Sal sekinroq.");

  const now = new Date();
  const thread = await prisma.supportThread.upsert({
    where: { userId: user.id },
    create: { userId: user.id, lastMessageAt: now, userReadAt: now },
    update: { lastMessageAt: now, userReadAt: now }, // writing means they have seen everything so far
    select: { id: true, lastAlertAt: true },
  });
  const message = await prisma.supportMessage.create({ data: { threadId: thread.id, senderId: user.id, body }, select });

  // The ping is claimed in the database first, so two messages at once cannot both ping. A claim that finds the time
  // already moved on sends nothing. Failing to reach Telegram never fails the person's message (notify never throws).
  if (shouldAlert(thread.lastAlertAt, now)) {
    const claimed = await prisma.supportThread.updateMany({
      where: { id: thread.id, lastAlertAt: thread.lastAlertAt },
      data: { lastAlertAt: now },
    });
    if (claimed.count === 1) void notifySupportMessage({ name: user.name, role: user.role, threadId: thread.id });
  }
  return ok({ message }, 201);
});
