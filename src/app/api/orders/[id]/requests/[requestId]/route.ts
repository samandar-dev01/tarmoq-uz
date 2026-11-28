import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { getParticipantOrder } from "@/lib/orders";
import { assertTransition } from "@/lib/orderMachine";
import { logAudit } from "@/lib/audit";
import { postOrderMessage } from "@/lib/messaging";
import { notifyCancelAgreed } from "@/lib/notify";
import { orderReference } from "@/lib/payments/manualPure";
import { dueDate } from "@/lib/deadline";
import { canAsk } from "@/lib/resolution";

type Ctx = { params: Promise<{ id: string; requestId: string }> };
const schema = z.object({ action: z.enum(["accept", "decline", "withdraw"]) });

/**
 * The answer to a request. The other side accepts or declines; the asker may take it back. An accepted extension moves
 * the deadline. An accepted cancellation does NOT move money by itself: the order goes to the admin, who returns the
 * payment and closes it (the same path as a dispute).
 */
export const POST = handle(async (req, ctx: Ctx) => {
  const { id, requestId } = await ctx.params;
  const user = await requireRole("CLIENT", "PROVIDER");
  const { action } = schema.parse(await readJson(req));
  const { order, actor } = await getParticipantOrder(id, user.id);

  const request = await prisma.$transaction(async (tx) => {
    const r = await tx.orderRequest.findFirst({ where: { id: requestId, orderId: order.id } });
    if (!r) throw new HttpError(404, "Soʻrov topilmadi.");
    if ((action === "withdraw") !== (r.requestedById === user.id)) throw new HttpError(403, "Buning uchun sizda ruxsat yoʻq.");
    const status = action === "accept" ? "ACCEPTED" : action === "decline" ? "DECLINED" : "WITHDRAWN";
    const claimed = await tx.orderRequest.updateMany({ where: { id: r.id, status: "PENDING" }, data: { status, resolvedAt: new Date() } });
    if (claimed.count !== 1) throw new HttpError(409, "Bu soʻrovga allaqachon javob berilgan.");

    if (action === "accept") {
      const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true, dueAt: true } });
      if (!canAsk(r.type, fresh.status)) throw new HttpError(409, "Buyurtma oʻzgargan. Sahifani yangilang.");
      if (r.type === "EXTEND") {
        await tx.order.update({ where: { id: order.id }, data: { dueAt: dueDate(fresh.dueAt ?? new Date(), r.extraDays ?? 0) } });
      } else {
        assertTransition(fresh.status, "DISPUTED", actor);
        const moved = await tx.order.updateMany({ where: { id: order.id, status: fresh.status }, data: { status: "DISPUTED" } });
        if (moved.count !== 1) throw new HttpError(409, "Buyurtma oʻzgargan. Sahifani yangilang.");
      }
    }
    const say =
      action === "withdraw" ? "Soʻrovimni qaytarib oldim."
      : action === "decline" ? "Soʻrovni rad etdim."
      : r.type === "EXTEND" ? `Muddatni ${r.extraDays} kunga uzaytirishga roziman.`
      : "Bekor qilishga roziman. Administrator toʻlovni qaytaradi.";
    await postOrderMessage(order.id, user.id, say, tx, "answered");
    return r;
  });
  if (action === "accept" && request.type === "CANCEL") void notifyCancelAgreed({ reference: orderReference(order.id) });
  await logAudit({ actorId: user.id, action: "ORDER_REQUEST_ANSWERED", entity: "Order", entityId: order.id, meta: { type: request.type, action } });
  return ok({ ok: true });
});
