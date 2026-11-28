import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkoutAddress, checkoutRequest, judgePayment, verifyWebhook, whopConfig, whopOffered } from "@/lib/payments/whopPure";

const keys = { WHOP_API_KEY: "key", WHOP_ACCOUNT_ID: "biz_1", WHOP_WEBHOOK_SECRET: "ws_secret" };

describe("Whop settings", () => {
  it("needs the key, the account and the webhook secret", () => {
    expect(whopConfig(keys)).not.toBeNull();
    for (const missing of Object.keys(keys)) expect(whopConfig({ ...keys, [missing]: " " })).toBeNull();
  });

  it("talks to the live API unless a development machine asks for the sandbox", () => {
    expect(whopConfig({ ...keys, NODE_ENV: "development" })!.apiBase).toBe("https://api.whop.com/api/v1");
    expect(whopConfig({ ...keys, NODE_ENV: "development", WHOP_SANDBOX: "true" })!.apiBase).toBe("https://sandbox-api.whop.com/api/v1");
  });

  it("ignores the sandbox and a custom address on a production server, so test cards never pay a real order", () => {
    const c = whopConfig({ ...keys, NODE_ENV: "production", WHOP_SANDBOX: "true", WHOP_API_BASE: "http://evil.test" })!;
    expect(c.apiBase).toBe("https://api.whop.com/api/v1");
    expect(c.siteBase).toBe("https://whop.com");
  });

  it("is offered only beside the card transfer or alone", () => {
    expect(whopOffered({ ...keys, PAYMENT_PROVIDER: "manual" })).toBe(true);
    expect(whopOffered({ ...keys, PAYMENT_PROVIDER: "whop" })).toBe(true);
    expect(whopOffered({ ...keys, PAYMENT_PROVIDER: "sandbox" })).toBe(false);
    expect(whopOffered({ ...keys })).toBe(false);
    expect(whopOffered({ PAYMENT_PROVIDER: "whop" })).toBe(false);
  });
});

describe("the payment page", () => {
  it("asks for one payment of the agreed price in soʻm and sends ids only", () => {
    const body = checkoutRequest({ accountId: "biz_1", productId: null, amount: 250000, paymentId: "p1", orderId: "o1", title: "T", redirectUrl: "https://site/x" });
    expect(body.variant).toEqual({ title: "T", billing_type: "one_time", initial_price: 250000, currency: "uzs", unlimited_stock: true });
    expect(body.metadata).toEqual({ paymentId: "p1", orderId: "o1" });
  });

  it("sends the way back only when it is https, which is all Whop accepts", () => {
    const make = (redirectUrl: string) => checkoutRequest({ accountId: "biz_1", productId: null, amount: 20000, paymentId: "p1", orderId: "o1", title: "T", redirectUrl });
    expect(make("https://site/checkout/o1?qaytdi=1")).toMatchObject({ redirect_url: "https://site/checkout/o1?qaytdi=1" });
    expect(make("http://localhost:3000/checkout/o1?qaytdi=1")).not.toHaveProperty("redirect_url");
  });

  it("only ever sends a client to an https page on whop.com", () => {
    expect(checkoutAddress("https://whop.com/checkout/ch_1/", "https://whop.com")).toBe("https://whop.com/checkout/ch_1/");
    expect(checkoutAddress("/checkout/ch_1", "https://sandbox.whop.com")).toBe("https://sandbox.whop.com/checkout/ch_1");
    for (const bad of ["http://whop.com/x", "https://whop.com.evil.test/x", "https://evilwhop.com/x", "javascript:alert(1)", "//evil.test/x", "", null, 5]) {
      expect(checkoutAddress(bad, "https://whop.com")).toBeNull();
    }
  });
});

describe("webhook signatures", () => {
  const secret = "ws_abc123";
  const now = new Date("2026-11-28T12:00:00Z");
  const ts = String(now.getTime() / 1000);
  const body = '{"type":"payment.succeeded","data":{"id":"pay_1"}}';
  const sign = (b: string, key = secret, time = ts) => `v1,${createHmac("sha256", key).update(`msg_1.${time}.${b}`).digest("base64")}`;
  const headers = (signature: string, time = ts) => new Headers({ "webhook-id": "msg_1", "webhook-timestamp": time, "webhook-signature": signature });

  it("accepts a correct signature, also among several", () => {
    expect(verifyWebhook(body, headers(sign(body)), secret, now)).toBe(true);
    expect(verifyWebhook(body, headers(`v1,AAAA ${sign(body)}`), secret, now)).toBe(true);
  });

  it("refuses a changed body, another key, a missing header and an unknown version", () => {
    expect(verifyWebhook(body.replace("pay_1", "pay_2"), headers(sign(body)), secret, now)).toBe(false);
    expect(verifyWebhook(body, headers(sign(body, "ws_other")), secret, now)).toBe(false);
    expect(verifyWebhook(body, new Headers(), secret, now)).toBe(false);
    expect(verifyWebhook(body, headers(sign(body).replace("v1,", "v2,")), secret, now)).toBe(false);
    expect(verifyWebhook(body, headers(sign(body, "")), "", now)).toBe(false);
  });

  it("refuses a message more than five minutes old or early", () => {
    for (const shift of [-301, 301]) {
      const time = String(Number(ts) + shift);
      expect(verifyWebhook(body, headers(sign(body, secret, time), time), secret, now)).toBe(false);
    }
  });
});

describe("what a Whop payment means for an order", () => {
  const paid = (amount: string, currency = "uzs") => ({ status: "paid", presentment_total: { amount, currency } });

  it("counts the agreed price or more, stated in soʻm", () => {
    expect(judgePayment(paid("250000.00"), 250000)).toBe("paid");
    expect(judgePayment(paid("250001"), 250000)).toBe("paid");
    expect(judgePayment({ status: "paid", presentment_total: { amount: "20.00", currency: "usd" }, total: { amount: "250000", currency: "UZS" } }, 250000)).toBe("paid");
  });

  it("never starts an order on less money, another currency or no amount", () => {
    expect(judgePayment(paid("2500.00"), 250000)).toBe("mismatch");
    expect(judgePayment(paid("250000", "usd"), 250000)).toBe("mismatch");
    expect(judgePayment({ status: "paid" }, 250000)).toBe("mismatch");
    expect(judgePayment(paid("250,000"), 250000)).toBe("mismatch");
  });

  it("ignores money that has not arrived or has gone back", () => {
    for (const status of ["open", "pending", "authorized", "void", "uncollectible"]) {
      expect(judgePayment({ ...paid("250000"), status }, 250000)).toBe("unpaid");
    }
    expect(judgePayment({ ...paid("250000"), refunded_at: "2026-11-28T00:00:00Z" }, 250000)).toBe("unpaid");
    expect(judgePayment({ ...paid("250000"), auto_refunded: true }, 250000)).toBe("unpaid");
  });
});
