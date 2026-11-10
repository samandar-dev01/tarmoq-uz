import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { assertTransition } from "@/lib/orderMachine";
import { refundEscrow, releaseEscrow } from "@/lib/payments/sandbox";
import { postOrderMessage } from "@/lib/messaging";
import { logAudit } from "@/lib/audit";

type Ctx = { params: { id: string } };
const schema = z.object({ resolution: z.enum(["release", "refund"]) });

/** Admin decides a dispute: pay the provider (order completes) or refund the client (order cancelled). */
export const POST = handle(async (req, { params }: Ctx) => {
  const admin = await requireRole("ADMIN");
  const { resolution } = schema.parse(await readJson(req));
  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) throw new HttpError(404, "Buyurtma topilmadi.");
  const target = resolution === "release" ? "COMPLETED" : "CANCELLED";
  assertTransition(order.status, target, "admin");

  const money = await prisma.$transaction(async (tx) => {
    const moved = await tx.order.updateMany({
      where: { id: order.id, status: "DISPUTED" },
      data: { status: target, ...(target === "COMPLETED" ? { completedAt: new Date() } : {}) },
    });
    if (moved.count !== 1) throw new HttpError(409, "Buyurtma oʻzgargan. Sahifani yangilang.");
    const result = resolution === "release" ? await releaseEscrow(tx, order.id) : await refundEscrow(tx, order.id);
    await postOrderMessage(
      order.id, admin.id,
      resolution === "release" ? "Administrator nizoni hal qildi: toʻlov ijodkorga oʻtkazildi." : "Administrator nizoni hal qildi: toʻlov mijozga qaytarildi.",
      tx,
    );
    return result;
  });
  await logAudit({ actorId: admin.id, action: "DISPUTE_RESOLVED", entity: "Order", entityId: order.id, meta: { resolution, ...money } });
  return ok({ status: target });
});
