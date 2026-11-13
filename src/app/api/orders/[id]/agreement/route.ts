import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, clientIp, handle, ok, readJson } from "@/lib/http";
import { assertTransition } from "@/lib/orderMachine";
import { logAudit } from "@/lib/audit";
import { postOrderMessage } from "@/lib/messaging";

type Ctx = { params: { id: string } };
const schema = z.object({ termsHash: z.string().length(64), accept: z.literal(true, { errorMap: () => ({ message: "Davom etish uchun shartlarni qabul qilishingiz kerak." }) }) });

/** Client accepts the exact terms version they were shown (identified by its hash). */
export const POST = handle(async (req, { params }: Ctx) => {
  const user = await requireRole("CLIENT");
  const input = schema.parse(await readJson(req));
  const ip = clientIp(req);

  const order = await prisma.order.findFirst({ where: { id: params.id, clientId: user.id } });
  if (!order) throw new HttpError(404, "Buyurtma topilmadi.");
  if (order.status !== "AGREEMENT_PENDING") throw new HttpError(409, "Qabul qilishingiz kutilayotgan shartlar yoʻq.");
  assertTransition("AGREEMENT_PENDING", "AWAITING_PAYMENT", "system");

  const result = await prisma.$transaction(async (tx) => {
    const latest = await tx.agreement.findFirst({ where: { orderId: order.id }, orderBy: { version: "desc" } });
    if (!latest || !latest.providerAcceptedAt) throw new HttpError(409, "Ijodkor hali shartlarni yubormagan.");
    if (latest.termsHash !== input.termsHash) throw new HttpError(409, "Shartlar oʻzgargan. Oxirgi versiyani koʻrib chiqing.");
    const accepted = await tx.agreement.updateMany({
      where: { id: latest.id, clientAcceptedAt: null },
      data: { clientAcceptedAt: new Date(), clientAcceptedIp: ip },
    });
    if (accepted.count !== 1) throw new HttpError(409, "Bu shartlar allaqachon qabul qilingan.");
    const moved = await tx.order.updateMany({ where: { id: order.id, status: "AGREEMENT_PENDING" }, data: { status: "AWAITING_PAYMENT" } });
    if (moved.count !== 1) throw new HttpError(409, "Buyurtma oʻzgargan. Sahifani yangilang.");
    await postOrderMessage(order.id, user.id, `Shartlarni qabul qildim (${latest.version}-versiya). Toʻlovga oʻtyapman.`, tx);
    return latest;
  });

  await logAudit({
    actorId: user.id, action: "AGREEMENT_ACCEPTED", entity: "Agreement", entityId: result.id,
    meta: { version: result.version, termsHash: result.termsHash, ip },
  });
  return ok({ status: "AWAITING_PAYMENT" });
});
