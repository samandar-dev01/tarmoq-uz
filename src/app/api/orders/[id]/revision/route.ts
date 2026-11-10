import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { assertTransition } from "@/lib/orderMachine";
import { getParticipantOrder } from "@/lib/orders";
import { logAudit } from "@/lib/audit";
import { postOrderMessage } from "@/lib/messaging";

type Ctx = { params: { id: string } };
const schema = z.object({ note: z.string().trim().min(10, "Ijodkorga nimani oʻzgartirish kerakligini yozing (kamida 10 ta belgi)").max(1000) });

export const POST = handle(async (req, { params }: Ctx) => {
  const user = await requireRole("CLIENT");
  const { note } = schema.parse(await readJson(req));
  const { order, actor } = await getParticipantOrder(params.id, user.id);
  if (actor !== "client") throw new HttpError(403, "Tuzatishni faqat mijoz soʻray oladi.");
  assertTransition(order.status, "IN_PROGRESS", "client");
  if (order.status !== "DELIVERED") throw new HttpError(409, "Tuzatish uchun topshirilgan ish yoʻq.");
  if (order.revisionsUsed >= order.revisionsAllowed) throw new HttpError(409, "Bu buyurtmada tuzatishlar qolmagan. Ishni qabul qilishingiz yoki nizo ochishingiz mumkin.");

  await prisma.$transaction(async (tx) => {
    const moved = await tx.order.updateMany({
      where: { id: order.id, status: "DELIVERED" },
      data: { status: "IN_PROGRESS", revisionsUsed: { increment: 1 } },
    });
    if (moved.count !== 1) throw new HttpError(409, "Buyurtma oʻzgargan. Sahifani yangilang.");
    await postOrderMessage(order.id, user.id, `Tuzatish soʻralmoqda: ${note}`, tx);
  });
  await logAudit({ actorId: user.id, action: "REVISION_REQUESTED", entity: "Order", entityId: order.id });
  return ok({ status: "IN_PROGRESS" });
});
