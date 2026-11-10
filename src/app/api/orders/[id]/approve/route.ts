import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok } from "@/lib/http";
import { assertTransition } from "@/lib/orderMachine";
import { getParticipantOrder } from "@/lib/orders";
import { releaseEscrow } from "@/lib/payments/sandbox";
import { logAudit } from "@/lib/audit";
import { postOrderMessage } from "@/lib/messaging";

type Ctx = { params: { id: string } };

/** Client approves the delivery: order completes and the held payment is released. */
export const POST = handle(async (_req, { params }: Ctx) => {
  const user = await requireRole("CLIENT");
  const { order, actor } = await getParticipantOrder(params.id, user.id);
  if (actor !== "client") throw new HttpError(403, "Ishni faqat mijoz qabul qila oladi.");
  assertTransition(order.status, "COMPLETED", "client");
  if ((await prisma.delivery.count({ where: { orderId: order.id } })) === 0) throw new HttpError(409, "Hali hech narsa topshirilmagan.");

  const released = await prisma.$transaction(async (tx) => {
    const moved = await tx.order.updateMany({ where: { id: order.id, status: "DELIVERED" }, data: { status: "COMPLETED", completedAt: new Date() } });
    if (moved.count !== 1) throw new HttpError(409, "Buyurtma oʻzgargan. Sahifani yangilang.");
    const r = await releaseEscrow(tx, order.id);
    await postOrderMessage(order.id, user.id, "Ishni qabul qildim. Rahmat!", tx);
    return r;
  });
  await logAudit({ actorId: user.id, action: "ORDER_APPROVED", entity: "Order", entityId: order.id, meta: released });
  return ok({ status: "COMPLETED" });
});
