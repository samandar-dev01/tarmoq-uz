import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { getParticipantOrder } from "@/lib/orders";
import { logAudit } from "@/lib/audit";
import { postOrderMessage } from "@/lib/messaging";
import { canAsk } from "@/lib/resolution";
import { lockOrder } from "@/lib/orderLock";

type Ctx = { params: Promise<{ id: string }> };
const schema = z
  .object({
    type: z.enum(["EXTEND", "CANCEL"]),
    extraDays: z.number({ invalid_type_error: "Kunlar sonini kiriting" }).int().min(1, "Kamida 1 kun").max(30, "Koʻpi bilan 30 kun").optional(),
    reason: z.string().trim().min(10, "Sababini yozing (kamida 10 ta belgi)").max(500),
  })
  .refine((v) => v.type !== "EXTEND" || v.extraDays !== undefined, { message: "Kunlar sonini kiriting", path: ["extraDays"] });

/** One side of an order asks the other to extend the deadline or to cancel. */
export const POST = handle(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireRole("CLIENT", "PROVIDER");
  const input = schema.parse(await readJson(req));
  const { order } = await getParticipantOrder(id, user.id);
  if (!canAsk(input.type, order.status)) throw new HttpError(409, "Bu soʻrovni hozir yuborib boʻlmaydi.");

  const created = await prisma.$transaction(async (tx) => {
    await lockOrder(tx, order.id);
    if ((await tx.orderRequest.count({ where: { orderId: order.id, status: "PENDING" } })) > 0) {
      throw new HttpError(409, "Javob kutayotgan soʻrov bor. Avval unga javob berilishi kerak.");
    }
    const r = await tx.orderRequest.create({
      data: { orderId: order.id, requestedById: user.id, type: input.type, extraDays: input.type === "EXTEND" ? input.extraDays : null, reason: input.reason },
    });
    await postOrderMessage(
      order.id, user.id,
      input.type === "EXTEND" ? `Muddatni ${input.extraDays} kunga uzaytirishni soʻrayman: ${input.reason}` : `Buyurtmani bekor qilishni soʻrayman: ${input.reason}`,
      tx, "request",
    );
    return r;
  });
  await logAudit({ actorId: user.id, action: "ORDER_REQUEST_CREATED", entity: "Order", entityId: order.id, meta: { type: input.type } });
  return ok({ request: { id: created.id } }, 201);
});
