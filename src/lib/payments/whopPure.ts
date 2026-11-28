// Pure rules for online payments through Whop (no database, no network) so they can be unit-tested.
// The shapes follow Whop's API v1 (docs.whop.com and the types of @whop/sdk 2.8.1).
import { createHmac, timingSafeEqual } from "node:crypto";

type Env = Record<string, string | undefined>;

const LIVE_API = "https://api.whop.com/api/v1";
const SANDBOX_API = "https://sandbox-api.whop.com/api/v1";

export type WhopConfig = { apiBase: string; siteBase: string; apiKey: string; accountId: string; webhookSecret: string; productId: string | null };

/**
 * Whop is set up only when the key, the account id and the webhook secret are all there: without the secret a
 * payment could not be confirmed on its own.
 *
 * SAFETY: the Whop sandbox (test cards, no money) and a custom API address are honoured only away from production.
 * A live server ignores both, so a forgotten test setting can never let a test card mark a real order as paid.
 */
export function whopConfig(env: Env = process.env): WhopConfig | null {
  const apiKey = env.WHOP_API_KEY?.trim();
  const accountId = env.WHOP_ACCOUNT_ID?.trim();
  const webhookSecret = env.WHOP_WEBHOOK_SECRET?.trim();
  if (!apiKey || !accountId || !webhookSecret) return null;
  const dev = env.NODE_ENV !== "production";
  const sandbox = dev && env.WHOP_SANDBOX === "true";
  const apiBase = ((dev && env.WHOP_API_BASE?.trim()) || (sandbox ? SANDBOX_API : LIVE_API)).replace(/\/+$/, "");
  return {
    apiBase,
    siteBase: sandbox ? "https://sandbox.whop.com" : "https://whop.com",
    apiKey, accountId, webhookSecret,
    productId: env.WHOP_PRODUCT_ID?.trim() || null,
  };
}

/**
 * Whether clients are offered the Whop button. It comes first, with the card transfer folded under it
 * (PAYMENT_PROVIDER=manual), or stands alone (PAYMENT_PROVIDER=whop). The internal test cards and a server with no
 * payment setting never show it.
 */
export const whopOffered = (env: Env = process.env): boolean =>
  (env.PAYMENT_PROVIDER === "whop" || env.PAYMENT_PROVIDER === "manual") && whopConfig(env) !== null;

/** The body of "create a checkout configuration": one payment of the agreed price, in soʻm (major units). */
export function checkoutRequest(a: { accountId: string; productId: string | null; amount: number; paymentId: string; orderId: string; title: string; redirectUrl: string }) {
  return {
    account_id: a.accountId,
    mode: "payment",
    // Whop refuses a way back that is not https. A site on a developer's machine sends none: after paying there, open
    // /checkout/<order>?qaytdi=1 by hand.
    ...(a.redirectUrl.startsWith("https://") ? { redirect_url: a.redirectUrl } : {}),
    // Ids only: no name, email or phone number leaves the site.
    metadata: { paymentId: a.paymentId, orderId: a.orderId },
    variant: {
      ...(a.productId ? { product_id: a.productId } : {}),
      title: a.title,
      billing_type: "one_time",
      initial_price: a.amount,
      currency: "uzs",
      unlimited_stock: true,
    },
  };
}

/** The address Whop returned for the payment page. Anything that is not an https page on whop.com is refused. */
export function checkoutAddress(url: unknown, siteBase: string): string | null {
  if (typeof url !== "string" || !url) return null;
  try {
    const u = new URL(url, siteBase);
    const ours = u.hostname === "whop.com" || u.hostname.endsWith(".whop.com");
    return u.protocol === "https:" && ours ? u.href : null;
  } catch {
    return null;
  }
}

const TOLERANCE_SECONDS = 5 * 60;

/**
 * Whop signs `{webhook-id}.{webhook-timestamp}.{raw body}` with HMAC-SHA256 (the Standard Webhooks layout). The key is
 * the literal text of the `ws_` secret, prefix included, as its own SDK does it. The header may carry several
 * "v1,<base64>" signatures. A message older or newer than five minutes is refused.
 */
export function verifyWebhook(rawBody: string, headers: Headers, secret: string, now: Date = new Date()): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signature = headers.get("webhook-signature");
  if (!secret || !id || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(now.getTime() / 1000) - Number(timestamp)) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${id}.${timestamp}.${rawBody}`).digest();
  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

type Money = { amount?: unknown; currency?: unknown } | null | undefined;

/** The parts of Whop's payment object the site reads. */
export type WhopPayment = {
  id?: unknown;
  status?: unknown;
  checkout_configuration_id?: unknown;
  refunded_at?: unknown;
  auto_refunded?: unknown;
  presentment_total?: Money;
  total?: Money;
};

/**
 * What a payment (read from Whop's API, never taken from a message) means for an order that costs `amount` soʻm.
 *  - "unpaid":   no money to count (not paid yet, failed, or already given back).
 *  - "paid":     at least the agreed price arrived, stated in soʻm.
 *  - "mismatch": money arrived but the price can not be confirmed (less than agreed, or not stated in soʻm). A person
 *                has to look: it never starts an order by itself.
 */
export function judgePayment(p: WhopPayment, amount: number): "paid" | "unpaid" | "mismatch" {
  if (p.status !== "paid" || p.refunded_at || p.auto_refunded === true) return "unpaid";
  const inSom = [p.presentment_total, p.total].find((m) => typeof m?.currency === "string" && m.currency.toLowerCase() === "uzs");
  if (!inSom || typeof inSom.amount !== "string" || !/^\d+(\.\d+)?$/.test(inSom.amount)) return "mismatch";
  return Number(inSom.amount) >= amount ? "paid" : "mismatch";
}
