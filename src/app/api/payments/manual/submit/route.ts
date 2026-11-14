import { randomUUID } from "crypto";
import { readFormLimited } from "@/lib/body";
import { manualPaymentsOn } from "@/lib/payments/mode";
import { orderReference } from "@/lib/payments/manualPure";
import { checkReceipt, receiptTooBigMessage, RECEIPT_MAX_BYTES } from "@/lib/payments/receiptPure";
import { submitManualPayment } from "@/lib/payments/manual";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";
import { notifyPaymentClaimed } from "@/lib/notify";
import { putFile, removeFile } from "@/lib/storage";

/**
 * The client says they sent the money and attaches the bank receipt (required). Nothing is held yet:
 * an admin looks at the receipt, checks the bank app and confirms.
 */
export const POST = handle(async (req) => {
  if (!manualPaymentsOn()) throw new HttpError(404, "Topilmadi.");
  const user = await requireRole("CLIENT");
  if (!rateLimit(`manual-pay:${user.id}`, 10, 15 * 60 * 1000)) throw new HttpError(429, "Juda koʻp urinish. Bir necha daqiqa kuting.");

  // SECURITY FIX (vibeguard #4): the body is counted while it is read. The old check trusted the Content-Length
  // header, which a chunked upload simply leaves out, and then loaded everything into memory. The form adds a
  // little to the file's own size.
  const form = await readFormLimited(req, RECEIPT_MAX_BYTES + 100_000, receiptTooBigMessage);
  const orderId = String(form.get("orderId") ?? "");
  if (!orderId) throw new HttpError(400, "Buyurtma topilmadi.");
  const file = form.get("receipt");
  if (!(file instanceof File)) throw new HttpError(400, "Toʻlov chekini yuklang.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const checked = checkReceipt(bytes);
  if (!checked.ok) throw new HttpError(checked.status, checked.message);

  // The extension and content type come from what the bytes really are, never from the client's file name or type.
  const key = `receipts/${orderId.replace(/[^\w-]/g, "")}/${randomUUID()}.${checked.type.ext}`;
  await putFile(key, bytes, checked.type.contentType);

  let created = false;
  try {
    const result = await submitManualPayment(orderId, user.id, { key, name: file.name.slice(0, 200), type: checked.type.contentType });
    created = result.created;
    if (created) {
      await logAudit({ actorId: user.id, action: "PAYMENT_CLAIMED", entity: "Payment", entityId: result.payment.id, meta: { orderId, amount: result.payment.amount, provider: "manual", receiptBytes: bytes.length } });
      // Not awaited: a slow or missing Telegram never delays the client. The helper never throws.
      void notifyPaymentClaimed({ amount: result.payment.amount, reference: orderReference(orderId) });
    }
  } finally {
    // A repeat press or any failure leaves the file attached to nothing, so remove it.
    if (!created) await removeFile(key).catch(() => undefined);
  }
  return ok({ status: "AWAITING_CONFIRMATION" });
});
