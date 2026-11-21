import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { SUPPORT_MAX_CHARS } from "@/lib/support";

type Ctx = { params: Promise<{ id: string }> };
const select = { id: true, fromStaff: true, body: true, createdAt: true } as const;
const sendSchema = z.object({
  body: z.string().trim().min(1, "Javob yozing").max(SUPPORT_MAX_CHARS, `Javob ${SUPPORT_MAX_CHARS} ta belgidan oshmasligi kerak`),
});

/** Poll for a thread the admin has open: the messages after `after` (all of them without it). Reading counts as seen. */
export const GET = handle(async (req, ctx: Ctx) => {
  const params = await ctx.params;
  await requireRole("ADMIN");
  const thread = await prisma.supportThread.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!thread) throw new HttpError(404, "Suhbat topilmadi.");

  const after = new URL(req.url).searchParams.get("after");
  let messages;
  if (after) {
    const exists = await prisma.supportMessage.findFirst({ where: { id: after, threadId: thread.id }, select: { id: true } });
    if (!exists) throw new HttpError(400, "Notoʻgʻri soʻrov parametri.");
    messages = await prisma.supportMessage.findMany({
      where: { threadId: thread.id }, cursor: { id: after }, skip: 1, take: 100, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select,
    });
  } else {
    messages = await prisma.supportMessage.findMany({ where: { threadId: thread.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 200, select });
  }
  if (!after || messages.length) await prisma.supportThread.update({ where: { id: thread.id }, data: { staffReadAt: new Date() } });
  return ok({ messages });
});

/** An admin answers. The person sees it the next time they open Help (and a dot shows on the Help button until then). */
export const POST = handle(async (req, ctx: Ctx) => {
  const params = await ctx.params;
  const admin = await requireRole("ADMIN");
  const { body } = sendSchema.parse(await readJson(req));
  const thread = await prisma.supportThread.findUnique({ where: { id: params.id }, select: { id: true, userId: true } });
  if (!thread) throw new HttpError(404, "Suhbat topilmadi.");

  const now = new Date();
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.supportMessage.create({ data: { threadId: thread.id, senderId: admin.id, fromStaff: true, body }, select });
    await tx.supportThread.update({ where: { id: thread.id }, data: { lastMessageAt: now, staffReadAt: now } });
    return created;
  });
  await logAudit({ actorId: admin.id, action: "SUPPORT_REPLIED", entity: "SupportThread", entityId: thread.id, meta: { to: thread.userId } });
  return ok({ message }, 201);
});
