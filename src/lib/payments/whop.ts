import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { logAudit } from "../audit";
import { postOrderMessage } from "../messaging";
import { notifyPaymentNeedsRefund } from "../notify";
import { siteUrl } from "../site";
import { markPaymentHeld } from "./escrow";
import { lockOrder } from "../orderLock";
import { orderReference } from "./manualPure";
import { checkoutAddress, checkoutRequest, judgePayment, whopConfig, type WhopConfig, type WhopPayment } from "./whopPure";

/**
 * Online card payment through Whop. The client pays on Whop's page; the order starts when Whop's own API says the
 * agreed amount was paid. Two roads lead there and either may arrive first: Whop's webhook, and a look at Whop when
 * the client comes back to the site. Nothing a browser or a message claims is believed without that look.
 */

/** Marks on a payment row: money arrived through Whop but started no order, so an admin has to give it back. */
export const WHOP_TO_REFUND = ["paid_needs_refund", "paid_amount_mismatch"] as const;

const UNREACHABLE = "Toʻlov xizmati bilan bogʻlanib boʻlmadi. Birozdan keyin qayta urinib koʻring.";

/** One call to Whop. The key is sent only here and nothing about the request is logged but the status. */
async function whopFetch<T>(config: WhopConfig, path: string, init: { body?: unknown; idempotencyKey?: string; timeoutMs: number }): Promise<T> {
  const res = await fetch(`${config.apiBase}${path}`, {
    method: init.body ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.idempotencyKey ? { "idempotency-key": init.idempotencyKey } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(init.timeoutMs),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).replaceAll(config.apiKey, "***").slice(0, 300);
    throw new Error(`Whop answered ${res.status} to ${path.split("?")[0]}: ${detail}`);
  }
  return (await res.json()) as T;
}

/**
 * The address of Whop's payment page for an order. The amount always comes from the order. A page already made for the
 * same amount is used again, so one order does not collect a pile of open payment pages.
 */
export async function startWhopCheckout(orderId: string, clientId: string): Promise<{ url: string | null; paid: boolean }> {
  const config = whopConfig();
  if (!config) throw new HttpError(404, "Topilmadi.");
  const order = await prisma.order.findFirst({ where: { id: orderId, clientId } });
  if (!order) throw new HttpError(404, "Buyurtma topilmadi.");
  if (order.status !== "AWAITING_PAYMENT") throw new HttpError(409, "Bu buyurtma hozir toʻlov kutmayapti.");
  if (!order.agreedPrice) throw new HttpError(409, "Bu buyurtma uchun hali narx kelishilmagan.");

  // Paid a moment ago (a second tab, a slow webhook)? Then there is nothing to pay again.
  if (await syncWhopOrder(orderId)) return { url: null, paid: true };

  if ((await prisma.payment.count({ where: { orderId, status: "AWAITING_CONFIRMATION" } })) > 0) {
    throw new HttpError(409, "Toʻlov tekshirilmoqda. Qayta toʻlamang.");
  }

  // Money from an earlier try is waiting for an admin: paying again could take it twice.
  if ((await prisma.payment.count({ where: { orderId, provider: "whop", failureCode: { in: [...WHOP_TO_REFUND] } } })) > 0) {
    throw new HttpError(409, "Toʻlovingiz administrator tekshiruvida. Qayta toʻlamang.");
  }

  const open = await prisma.payment.findFirst({
    where: { orderId, provider: "whop", status: "REQUIRES_PAYMENT", amount: order.agreedPrice, checkoutUrl: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (open?.checkoutUrl) return { url: open.checkoutUrl, paid: false };

  const payment = await prisma.payment.create({ data: { orderId, amount: order.agreedPrice, provider: "whop" } });
  try {
    const made = await whopFetch<{ id?: unknown; purchase_url?: unknown }>(config, "/checkout_configurations", {
      body: checkoutRequest({
        accountId: config.accountId, productId: config.productId, amount: payment.amount, paymentId: payment.id, orderId,
        title: `Tarmoq.uz ${orderReference(orderId)}`,
        redirectUrl: `${siteUrl()}/checkout/${orderId}?qaytdi=1`,
      }),
      idempotencyKey: payment.id,
      timeoutMs: 10_000,
    });
    const url = checkoutAddress(made.purchase_url, config.siteBase);
    if (typeof made.id !== "string" || !url) throw new Error("Whop returned no checkout id or no whop.com address");
    await prisma.payment.update({ where: { id: payment.id }, data: { providerRef: made.id, checkoutUrl: url } });
    await logAudit({ actorId: clientId, action: "PAYMENT_STARTED", entity: "Payment", entityId: payment.id, meta: { orderId, amount: payment.amount, provider: "whop" } });
    return { url, paid: false };
  } catch (e) {
    console.error("[whop] could not create a checkout:", (e as Error)?.message);
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureCode: "checkout_failed" } });
    throw new HttpError(502, UNREACHABLE);
  }
}

export type ApplyResult = "held" | "refund_needed" | "ignored";

/**
 * Counts one Whop payment. Safe to call any number of times, from both roads at once: the order's row is locked and
 * a Whop payment id can sit on one row only. Money that can not start the order (the terms changed, the order was
 * cancelled or already paid, the amount is wrong) is written down for an admin to give back, never dropped.
 */
export async function applyWhopPayment(whop: WhopPayment): Promise<ApplyResult> {
  const whopId = whop.id;
  const checkoutId = whop.checkout_configuration_id;
  if (typeof whopId !== "string" || typeof checkoutId !== "string") return "ignored";
  const row = await prisma.payment.findUnique({ where: { providerRef: checkoutId } });
  if (!row || row.provider !== "whop") return "ignored"; // not a payment page this site made
  const verdict = judgePayment(whop, row.amount);
  if (verdict === "unpaid") return "ignored";

  let outcome: { result: ApplyResult; paymentId: string; amount: number; clientId: string };
  try {
    outcome = await prisma.$transaction(async (tx) => {
      await lockOrder(tx, row.orderId);
      const order = await tx.order.findUniqueOrThrow({ where: { id: row.orderId }, select: { status: true, agreedPrice: true, clientId: true } });
      const done = (result: ApplyResult, paymentId = row.id) => ({ result, paymentId, amount: row.amount, clientId: order.clientId });
      if (await tx.payment.findUnique({ where: { providerPaymentId: whopId }, select: { id: true } })) return done("ignored");

      const current = await tx.payment.findUniqueOrThrow({ where: { id: row.id } });
      const fits =
        verdict === "paid" && current.status === "REQUIRES_PAYMENT" && !current.providerPaymentId &&
        order.status === "AWAITING_PAYMENT" && order.agreedPrice === current.amount;
      if (fits) {
        await markPaymentHeld(tx, { orderId: row.orderId, paymentId: row.id, from: "REQUIRES_PAYMENT", data: { providerPaymentId: whopId } });
        await postOrderMessage(row.orderId, order.clientId, "Toʻlov qabul qilindi. Ijodkor ishni boshlashi mumkin.", tx, "payment");
        return done("held");
      }

      const failureCode = verdict === "mismatch" ? "paid_amount_mismatch" : "paid_needs_refund";
      const record = { status: "FAILED" as const, failureCode, providerPaymentId: whopId };
      // A second payment on the same page gets a row of its own, so the first one's record stays as it is.
      const target =
        current.providerPaymentId || current.status === "HELD" || current.status === "RELEASED" || current.status === "REFUNDED"
          ? await tx.payment.create({ data: { orderId: row.orderId, amount: row.amount, provider: "whop", ...record } })
          : await tx.payment.update({ where: { id: row.id }, data: record });
      await postOrderMessage(row.orderId, order.clientId, "Toʻlov qabul qilindi, lekin buyurtmaga qoʻshilmadi. Administrator tekshiradi.", tx);
      return done("refund_needed", target.id);
    });
  } catch (e) {
    // The other road counted this same Whop payment a moment ago.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "ignored";
    throw e;
  }

  if (outcome.result !== "ignored") {
    await logAudit({
      actorId: outcome.clientId,
      action: outcome.result === "held" ? "PAYMENT_HELD" : "PAYMENT_NEEDS_REFUND",
      entity: "Payment",
      entityId: outcome.paymentId,
      meta: { orderId: row.orderId, amount: outcome.amount, provider: "whop", whopPaymentId: whopId },
    });
  }
  // Not awaited: Telegram being slow must not make Whop think the webhook failed. The helper never throws.
  if (outcome.result === "refund_needed") void notifyPaymentNeedsRefund({ reference: orderReference(row.orderId) });
  return outcome.result;
}

/** Reads one payment from Whop and counts it. Throws when Whop can not be reached, so the caller can try again. */
export async function confirmWhopPayment(whopPaymentId: string): Promise<ApplyResult> {
  const config = whopConfig();
  if (!config) return "ignored";
  const payment = await whopFetch<WhopPayment>(config, `/payments/${encodeURIComponent(whopPaymentId)}`, { timeoutMs: 4_000 });
  return applyWhopPayment(payment);
}

/**
 * Asks Whop whether any payment page of this order has been paid, and counts what it finds. True when the order
 * started because of it. Never throws: when Whop is unreachable the page simply stays as it was.
 */
export async function syncWhopOrder(orderId: string): Promise<boolean> {
  const config = whopConfig();
  if (!config) return false;
  const waiting = await prisma.payment.findMany({
    where: { orderId, provider: "whop", providerRef: { not: null }, providerPaymentId: null },
    orderBy: { createdAt: "asc" },
    select: { providerRef: true, createdAt: true },
  });
  if (waiting.length === 0) return false;
  const pages = new Set(waiting.map((w) => w.providerRef));
  try {
    const query = new URLSearchParams({
      account_id: config.accountId,
      status: "paid",
      // A few minutes of slack for clocks that differ.
      created_after: new Date(waiting[0]!.createdAt.getTime() - 5 * 60 * 1000).toISOString(),
      first: "100",
    });
    const list = await whopFetch<{ data?: WhopPayment[] }>(config, `/payments?${query}`, { timeoutMs: 4_000 });
    let held = false;
    for (const p of list.data ?? []) {
      if (typeof p.id !== "string" || typeof p.checkout_configuration_id !== "string" || !pages.has(p.checkout_configuration_id)) continue;
      if ((await confirmWhopPayment(p.id)) === "held") held = true;
    }
    return held;
  } catch (e) {
    console.error("[whop] could not check an order:", (e as Error)?.message);
    return false;
  }
}

/** The admin gave the money back in the Whop dashboard. */
export async function markWhopRefunded(paymentId: string, adminId: string) {
  const done = await prisma.payment.updateMany({
    where: { id: paymentId, provider: "whop", failureCode: { in: [...WHOP_TO_REFUND] } },
    data: { failureCode: "paid_refunded" },
  });
  if (done.count !== 1) throw new HttpError(409, "Bu toʻlov allaqachon koʻrib chiqilgan. Sahifani yangilang.");
  await logAudit({ actorId: adminId, action: "PAYMENT_REFUND_RECORDED", entity: "Payment", entityId: paymentId, meta: { provider: "whop" } });
}
