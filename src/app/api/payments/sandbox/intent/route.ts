import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/http";
import { computeFees } from "@/lib/payments/pure";
import { feePercent, getOrCreateIntent } from "@/lib/payments/sandbox";

const schema = z.object({ orderId: z.string().min(1) });

export const POST = handle(async (req) => {
  const user = await requireRole("CLIENT");
  const { orderId } = schema.parse(await readJson(req));
  const payment = await getOrCreateIntent(orderId, user.id);
  return ok({
    payment: { id: payment.id, amount: payment.amount, currency: payment.currency, sandbox: true },
    fees: computeFees(payment.amount, feePercent()),
  });
});
