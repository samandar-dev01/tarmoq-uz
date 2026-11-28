import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, clientIp, handle, ok, readJson } from "@/lib/http";
import { assertTransition } from "@/lib/orderMachine";
import { logAudit } from "@/lib/audit";
import { postOrderMessage } from "@/lib/messaging";
import { lockOrder } from "@/lib/orderLock";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ termsHash: z.string().length(64), accept: z.literal(true, { errorMap: () => ({ message: "Davom etish uchun shartlarni qabul qilishingiz kerak." }) }) });

/**
 * The side that has not yet accepted the latest terms accepts exactly the version they were shown (identified by its
 * hash): usually the client, or the creator when the client asked for the change. Then the order waits for payment.
 */
export const POST = handle(async (req, ctx: Ctx) => {
  const params = await ctx.params;
  const user = await requireRole("CLIENT", "PROVIDER");
  const input = schema.parse(await readJson(req));
  const ip = clientIp(req);
  const asClient = user.role === "CLIENT";

  const order = await prisma.order.findFirst({ where: { id: params.id, ...(asClient ? { clientId: user.id } : { providerId: user.id }) } });
  if (!order) throw new HttpError(404, "Buyurtma topilmadi.");
  if (order.status !== "AGREEMENT_PENDING") throw new HttpError(409, "Qabul qilishingiz kutilayotgan shartlar yoʻq.");
  assertTransition("AGREEMENT_PENDING", "AWAITING_PAYMENT", "system");

  const result = await prisma.$transaction(async (tx) => {
    await lockOrder(tx, order.id);
    const latest = await tx.agreement.findFirst({ where: { orderId: order.id }, orderBy: { version: "desc" } });
    // The other side must have offered it: nobody accepts for both.
    if (!latest || !(asClient ? latest.providerAcceptedAt : latest.clientAcceptedAt)) {
      throw new HttpError(409, asClient ? "Ijodkor hali shartlarni yubormagan." : "Qabul qilishingiz kutilayotgan shartlar yoʻq.");
    }
    if (latest.termsHash !== input.termsHash) throw new HttpError(409, "Shartlar oʻzgargan. Oxirgi versiyani koʻrib chiqing.");
    const now = new Date();
    const accepted = await tx.agreement.updateMany({
      where: { id: latest.id, ...(asClient ? { clientAcceptedAt: null } : { providerAcceptedAt: null }) },
      data: asClient ? { clientAcceptedAt: now, clientAcceptedIp: ip } : { providerAcceptedAt: now, providerAcceptedIp: ip },
    });
    if (accepted.count !== 1) throw new HttpError(409, "Bu shartlar allaqachon qabul qilingan.");
    const moved = await tx.order.updateMany({ where: { id: order.id, status: "AGREEMENT_PENDING" }, data: { status: "AWAITING_PAYMENT" } });
    if (moved.count !== 1) throw new HttpError(409, "Buyurtma oʻzgargan. Sahifani yangilang.");
    await postOrderMessage(
      order.id, user.id,
      asClient ? `Shartlarni qabul qildim (${latest.version}-versiya). Toʻlovga oʻtyapman.` : `Shartlarni qabul qildim (${latest.version}-versiya). Toʻlovni kutaman.`,
      tx,
      "accepted",
    );
    return latest;
  });

  await logAudit({
    actorId: user.id, action: "AGREEMENT_ACCEPTED", entity: "Agreement", entityId: result.id,
    meta: { version: result.version, termsHash: result.termsHash, ip },
  });
  return ok({ status: "AWAITING_PAYMENT" });
});
