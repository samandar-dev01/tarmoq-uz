import { z } from "zod";
import { paymentsAreTest } from "@/lib/payments/mode";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { platformFee } from "@/lib/fees";
import { getOrCreateIntent } from "@/lib/payments/sandbox";

const schema = z.object({ orderId: z.string().min(1) });

export const POST = handle(async (req) => {
  // Test cards must stop working the day a real gateway is switched on.
  if (!paymentsAreTest()) throw new HttpError(404, "Topilmadi.");
  const user = await requireRole("CLIENT");
  const { orderId } = schema.parse(await readJson(req));
  const payment = await getOrCreateIntent(orderId, user.id);
  return ok({
    payment: { id: payment.id, amount: payment.amount, currency: payment.currency, sandbox: true },
    fees: platformFee(payment.amount),
  });
});
