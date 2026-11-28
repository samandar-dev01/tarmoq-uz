import { readBodyLimited } from "@/lib/body";
import { HttpError, handle, ok } from "@/lib/http";
import { confirmWhopPayment } from "@/lib/payments/whop";
import { verifyWebhook, whopConfig } from "@/lib/payments/whopPure";

/**
 * Whop tells the site a payment happened. There is no session: the signature is the proof of who is calling, and the
 * payment is then read from Whop's API, so nothing in the message itself is trusted. It stays open whenever the Whop
 * keys are set (even if the pay button is switched off later), so money already on its way is still counted.
 * Any error answers non-2xx and Whop sends the message again.
 */
export const POST = handle(async (req) => {
  const config = whopConfig();
  if (!config) throw new HttpError(404, "Topilmadi.");
  // The signature covers the exact bytes, so the raw text is read first and parsed only after the check.
  const raw = (await readBodyLimited(req, 256 * 1024, "Soʻrov juda katta.")).toString("utf8");
  if (!verifyWebhook(raw, req.headers, config.webhookSecret)) throw new HttpError(401, "Imzo notoʻgʻri.");

  let event: { type?: unknown; data?: { id?: unknown } };
  try {
    event = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Soʻrov notoʻgʻri shaklda yuborildi.");
  }
  if (event?.type !== "payment.succeeded" || typeof event.data?.id !== "string") return ok({ result: "ignored" });
  return ok({ result: await confirmWhopPayment(event.data.id) });
});
