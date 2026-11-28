import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { startWhopCheckout } from "@/lib/payments/whop";
import { whopOffered } from "@/lib/payments/whopPure";

const schema = z.object({ orderId: z.string().min(1) });

/** The client presses "pay by card": answers with the address of Whop's payment page for this order. */
export const POST = handle(async (req) => {
  if (!whopOffered()) throw new HttpError(404, "Topilmadi.");
  const user = await requireRole("CLIENT");
  if (!rateLimit(`whop-pay:${user.id}`, 10, 15 * 60 * 1000)) throw new HttpError(429, "Toʻlov urinishlari juda koʻp. Bir necha daqiqa kuting.");
  const { orderId } = schema.parse(await readJson(req));
  return ok(await startWhopCheckout(orderId, user.id));
});
