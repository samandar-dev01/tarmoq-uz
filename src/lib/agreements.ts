import { createHash } from "crypto";
import { formatUZS } from "./format";

export type TermsInput = {
  orderId: string;
  version: number;
  serviceTitle: string;
  clientName: string;
  providerName: string;
  price: number;
  deliveryDays: number;
  revisions: number;
  notes?: string;
  feePercent: number;
};

export function buildTermsText(t: TermsInput): string {
  return [
    `SERVICE AGREEMENT (version ${t.version})`,
    `1. Parties: Client ${t.clientName} and Provider ${t.providerName}.`,
    `2. Service: ${t.serviceTitle}.`,
    `3. Price: ${formatUZS(t.price)}, paid in advance and held by the platform until the client approves the delivered work.`,
    `4. Delivery: within ${t.deliveryDays} ${t.deliveryDays === 1 ? "day" : "days"} after the payment is confirmed.`,
    `5. Revisions: ${t.revisions} ${t.revisions === 1 ? "revision is" : "revisions are"} included.`,
    `6. Scope notes: ${t.notes?.trim() ? t.notes.trim() : "None."}`,
    `7. Approval and release: when the client approves the delivery, the held payment is released to the provider, minus the platform fee.`,
    `8. Cancellation: before payment either party may cancel at no cost. After payment, problems are handled through the dispute process.`,
    `9. Disputes: either party may open a dispute while the work is in progress or delivered. An administrator decides whether to release the payment to the provider or refund the client.`,
    `10. Platform fee: ${t.feePercent}% of the price is deducted from the provider payout when the payment is released.`,
    `11. Use of the video: the client may use the delivered video for the purpose described in the order brief.`,
  ].join("\n");
}

/** Fingerprint of exactly what both parties accepted. Stored with the acceptance record. */
export function hashTerms(t: Pick<TermsInput, "orderId" | "version" | "price" | "deliveryDays" | "revisions"> & { termsText: string }): string {
  return createHash("sha256")
    .update(JSON.stringify([t.orderId, t.version, t.price, t.deliveryDays, t.revisions, t.termsText]))
    .digest("hex");
}
