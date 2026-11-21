import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle, ok } from "@/lib/http";

/** How many answers from the support team the person has not opened yet. One light query, polled by the Help button. */
export const GET = handle(async () => {
  const user = await requireRole("CLIENT", "PROVIDER");
  const thread = await prisma.supportThread.findUnique({ where: { userId: user.id }, select: { id: true, userReadAt: true } });
  if (!thread) return ok({ unread: 0 });
  const unread = await prisma.supportMessage.count({
    where: { threadId: thread.id, fromStaff: true, ...(thread.userReadAt ? { createdAt: { gt: thread.userReadAt } } : {}) },
  });
  return ok({ unread });
});
