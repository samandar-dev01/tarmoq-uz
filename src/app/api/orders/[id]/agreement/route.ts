import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, clientIp, handle, ok, readJson } from "@/lib/http";
import { assertTransition } from "@/lib/orderMachine";
import { logAudit } from "@/lib/audit";
import { postOrderMessage } from "@/lib/messaging";

type Ctx = { params: { id: string } };
const schema = z.object({ termsHash: z.string().length(64), accept: z.literal(true, { errorMap: () => ({ message: "You must accept the terms." }) }) });

/** Client accepts the exact terms version they were shown (identified by its hash). */
export const POST = handle(async (req, { params }: Ctx) => {
  const user = await requireRole("CLIENT");
  const input = schema.parse(await readJson(req));
  const ip = clientIp(req);

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order || order.clientId !== user.id) throw new HttpError(404, "Order not found.");
  if (order.status !== "AGREEMENT_PENDING") throw new HttpError(409, "There are no terms waiting for your acceptance.");
  assertTransition("AGREEMENT_PENDING", "AWAITING_PAYMENT", "system");

  const result = await prisma.$transaction(async (tx) => {
    const latest = await tx.agreement.findFirst({ where: { orderId: order.id }, orderBy: { version: "desc" } });
    if (!latest || !latest.providerAcceptedAt) throw new HttpError(409, "The provider has not sent terms yet.");
    if (latest.termsHash !== input.termsHash) throw new HttpError(409, "The terms changed. Please review the latest version.");
    const accepted = await tx.agreement.updateMany({
      where: { id: latest.id, clientAcceptedAt: null },
      data: { clientAcceptedAt: new Date(), clientAcceptedIp: ip },
    });
    if (accepted.count !== 1) throw new HttpError(409, "These terms were already accepted.");
    const moved = await tx.order.updateMany({ where: { id: order.id, status: "AGREEMENT_PENDING" }, data: { status: "AWAITING_PAYMENT" } });
    if (moved.count !== 1) throw new HttpError(409, "The order changed. Reload the page.");
    await postOrderMessage(order.id, user.id, `I accepted the terms (version ${latest.version}). Proceeding to payment.`, tx);
    return latest;
  });

  await logAudit({
    actorId: user.id, action: "AGREEMENT_ACCEPTED", entity: "Agreement", entityId: result.id,
    meta: { version: result.version, termsHash: result.termsHash, ip },
  });
  return ok({ status: "AWAITING_PAYMENT" });
});
