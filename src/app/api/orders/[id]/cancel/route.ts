import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { assertTransition } from "@/lib/orderMachine";
import { getParticipantOrder } from "@/lib/orders";
import { logAudit } from "@/lib/audit";
import { postOrderMessage } from "@/lib/messaging";

type Ctx = { params: { id: string } };
const schema = z.object({ reason: z.string().trim().max(500).optional() });

/** Cancel (or decline) before any money is held. After payment, use the dispute flow. */
export const POST = handle(async (req, { params }: Ctx) => {
  const user = await requireRole("CLIENT", "PROVIDER");
  const { reason } = schema.parse(await readJson(req));
  const { order, actor } = await getParticipantOrder(params.id, user.id);
  assertTransition(order.status, "CANCELLED", actor);

  await prisma.$transaction(async (tx) => {
    const moved = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: "CANCELLED" } });
    if (moved.count !== 1) throw new HttpError(409, "The order changed. Reload the page.");
    await tx.payment.updateMany({ where: { orderId: order.id, status: "REQUIRES_PAYMENT" }, data: { status: "FAILED", failureCode: "order_cancelled" } });
    await postOrderMessage(order.id, user.id, `Order cancelled${reason ? `: ${reason}` : "."}`, tx);
  });
  await logAudit({ actorId: user.id, action: "ORDER_CANCELLED", entity: "Order", entityId: order.id, meta: { by: actor, reason } });
  return ok({ status: "CANCELLED" });
});
