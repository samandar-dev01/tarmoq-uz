import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { HttpError } from "@/lib/errors";
import { confirmPayment } from "@/lib/payments/sandbox";

const schema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  // NOTE: there is deliberately no "success" field. The server alone decides the outcome.
  cardNumber: z.string().min(1, "Karta raqamini kiriting").max(30),
  expMonth: z.number({ required_error: "Amal qilish muddatini kiriting", invalid_type_error: "Amal qilish muddatini kiriting" }).int(),
  expYear: z.number({ required_error: "Amal qilish muddatini kiriting", invalid_type_error: "Amal qilish muddatini kiriting" }).int(),
  cvc: z.string().min(3, "Xavfsizlik kodini kiriting").max(4),
});

export const POST = handle(async (req) => {
  const user = await requireRole("CLIENT");
  if (!rateLimit(`pay:${user.id}`, 15, 15 * 60 * 1000)) throw new HttpError(429, "Toʻlov urinishlari juda koʻp. Bir necha daqiqa kuting.");
  const input = schema.parse(await readJson(req));

  const result = await confirmPayment({
    orderId: input.orderId,
    paymentId: input.paymentId,
    clientId: user.id,
    card: { number: input.cardNumber, expMonth: input.expMonth, expYear: input.expYear, cvc: input.cvc },
  });
  if (!result.ok) {
    return Response.json({ error: result.message, code: result.code }, { status: 402 });
  }
  return ok({ status: "HELD", orderStatus: "IN_PROGRESS" });
});
