import type { Prisma } from "@prisma/client";
import { buildTermsText, hashTerms } from "./agreements";

/**
 * The first version of an agreed order's terms: the creator offered them (a published package or a custom offer) and the
 * client accepts them now, so both acceptances are recorded at once.
 */
export async function createAcceptedAgreement(
  tx: Prisma.TransactionClient,
  a: { orderId: string; serviceTitle: string; clientName: string; providerName: string; price: number; deliveryDays: number; revisions: number; notes?: string; ip: string },
) {
  const terms = { price: a.price, deliveryDays: a.deliveryDays, revisions: a.revisions };
  const termsText = buildTermsText({ orderId: a.orderId, version: 1, serviceTitle: a.serviceTitle, clientName: a.clientName, providerName: a.providerName, notes: a.notes, ...terms });
  const now = new Date();
  await tx.agreement.create({
    data: {
      orderId: a.orderId, version: 1, termsText, price: a.price, deliveryDays: a.deliveryDays,
      termsHash: hashTerms({ orderId: a.orderId, version: 1, ...terms, termsText }),
      providerAcceptedAt: now, clientAcceptedAt: now, clientAcceptedIp: a.ip,
    },
  });
}
