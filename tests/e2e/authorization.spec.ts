import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiAs, registerApi, jasurServiceId, goodBrief } from "./helpers";

/**
 * P0-5: one check per authed route. User A (a stranger: another client, and another provider) must get
 * 403 or 404 on user B's order, conversation, delivery, payment and review. Never 200, never a 409 that
 * would confirm the row exists.
 *
 * The order is walked through its whole life so that each route is hit in the state where the OWNER
 * would succeed. A stranger being refused there is what proves the ownership check, not the state check.
 */
const DENIED = [403, 404];
const tinyVideo = { name: "clip.mp4", mimeType: "video/mp4", buffer: Buffer.from("not really a video, the server checks the extension") };

test("strangers are refused on every order, conversation, delivery, payment and review route", async () => {
  const owner = await registerApi("CLIENT");
  const otherClient = await registerApi("CLIENT");
  const jasur = await apiAs("jasur@demo.test"); // the order's provider
  const otherProvider = await apiAs("madina@demo.test");
  const strangers: [string, APIRequestContext][] = [["another client", otherClient.ctx], ["another provider", otherProvider]];

  const denied = async (label: string, call: (ctx: APIRequestContext) => Promise<{ status(): number }>) => {
    for (const [who, ctx] of strangers) {
      const status = (await call(ctx)).status();
      expect(DENIED, `${label} as ${who} returned ${status}`).toContain(status);
    }
  };
  // Pages refuse in one of two ways: a 404, or (wrong role for the whole section) a redirect to /forbidden.
  const deniedPage = async (path: string) => {
    for (const [who, ctx] of strangers) {
      const res = await ctx.get(path, { maxRedirects: 0 });
      const refused = res.status() === 404 || (res.status() >= 300 && res.status() < 400 && /\/forbidden$/.test(res.headers()["location"] ?? ""));
      expect(refused, `GET ${path} as ${who} returned ${res.status()} ${res.headers()["location"] ?? ""}`).toBe(true);
    }
  };

  // --- REQUESTED ---
  const serviceId = await jasurServiceId(owner.ctx);
  const created = await owner.ctx.post("/api/orders", { data: { serviceId, brief: goodBrief } });
  expect(created.status()).toBe(201);
  const orderId = (await created.json()).order.id as string;
  const order = `/api/orders/${orderId}`;

  const convs = (await (await owner.ctx.get("/api/conversations")).json()).conversations as { id: string; orderId: string | null }[];
  const conversationId = convs.find((c) => c.orderId === orderId)!.id;

  await deniedPage(`/orders/${orderId}`);
  await deniedPage(`/checkout/${orderId}`);
  await deniedPage(`/messages/${conversationId}`);
  await denied("GET /api/conversations/[id]/messages", (c) => c.get(`/api/conversations/${conversationId}/messages`));
  await denied("POST /api/conversations/[id]/messages", (c) => c.post(`/api/conversations/${conversationId}/messages`, { data: { body: "salom" } }));
  await denied("POST propose", (c) => c.post(`${order}/propose`, { data: { price: 300000, deliveryDays: 2, revisions: 1 } }));
  // the stranger's own conversation list never contains it
  for (const [who, ctx] of strangers) {
    const list = (await (await ctx.get("/api/conversations")).json()).conversations as { id: string }[];
    expect(list.some((c) => c.id === conversationId), `conversation listed for ${who}`).toBe(false);
  }

  // --- AGREEMENT_PENDING ---
  const proposed = await jasur.post(`${order}/propose`, { data: { price: 300000, deliveryDays: 2, revisions: 1 } });
  expect(proposed.status()).toBe(201);
  const termsHash = (await proposed.json()).agreement.termsHash as string;
  await denied("POST agreement", (c) => c.post(`${order}/agreement`, { data: { termsHash, accept: true } }));
  await denied("POST cancel", (c) => c.post(`${order}/cancel`, { data: {} }));

  // --- AWAITING_PAYMENT ---
  expect((await owner.ctx.post(`${order}/agreement`, { data: { termsHash, accept: true } })).status()).toBe(200);
  await denied("POST payments intent", (c) => c.post("/api/payments/sandbox/intent", { data: { orderId } }));
  const intent = await owner.ctx.post("/api/payments/sandbox/intent", { data: { orderId } });
  expect(intent.status()).toBe(200);
  const paymentId = (await intent.json()).payment.id as string;
  const card = { cardNumber: "4242 4242 4242 4242", expMonth: 12, expYear: 2034, cvc: "123" };
  await denied("POST payments confirm", (c) => c.post("/api/payments/sandbox/confirm", { data: { orderId, paymentId, ...card } }));

  // --- IN_PROGRESS ---
  expect((await owner.ctx.post("/api/payments/sandbox/confirm", { data: { orderId, paymentId, ...card } })).status()).toBe(200);
  await denied("POST delivery (upload)", (c) => c.post(`${order}/delivery`, { multipart: { file: tinyVideo } }));
  await denied("POST dispute", (c) => c.post(`${order}/dispute`, { data: { reason: "Bu mening buyurtmam emas, lekin sinab koʻraman." } }));

  // --- DELIVERED ---
  const uploaded = await jasur.post(`${order}/delivery`, { multipart: { file: tinyVideo } });
  expect(uploaded.status()).toBe(201);
  const deliveryId = (await uploaded.json()).delivery.id as string;
  await denied("GET delivery file", (c) => c.get(`${order}/delivery/${deliveryId}`));
  await denied("GET delivery file (download)", (c) => c.get(`${order}/delivery/${deliveryId}?download=1`));
  await denied("POST revision", (c) => c.post(`${order}/revision`, { data: { note: "Iltimos, musiqani almashtiring va subtitr qoʻshing." } }));
  await denied("POST approve", (c) => c.post(`${order}/approve`));
  // a delivery id under someone else's order id is not a way in either
  const mine = await otherClient.ctx.post("/api/orders", { data: { serviceId, brief: goodBrief } });
  const myOrderId = (await mine.json()).order.id as string;
  expect((await otherClient.ctx.get(`/api/orders/${myOrderId}/delivery/${deliveryId}`)).status()).toBe(404);

  // --- COMPLETED ---
  expect((await owner.ctx.post(`${order}/approve`)).status()).toBe(200);
  await denied("POST review", (c) => c.post(`${order}/review`, { data: { rating: 1, comment: "Bu sharhni begona odam yozmoqda." } }));
  // the provider on the order cannot review it either: reviews are for its client only
  expect(DENIED).toContain((await jasur.post(`${order}/review`, { data: { rating: 5, comment: "Oʻzimga oʻzim besh baho qoʻyaman." } })).status());

  // nothing a stranger tried left a mark: the owner still sees a completed order and can review it once
  expect((await owner.ctx.post(`${order}/review`, { data: { rating: 5, comment: "Juda yaxshi ish, rahmat!" } })).status()).toBe(201);
  expect((await owner.ctx.post(`${order}/review`, { data: { rating: 5, comment: "Ikkinchi sharh boʻlmasligi kerak." } })).status()).toBe(409);

  for (const c of [owner.ctx, otherClient.ctx, jasur, otherProvider]) await c.dispose();
});

test("admin-only routes refuse clients and providers", async () => {
  const client = await registerApi("CLIENT");
  const provider = await apiAs("madina@demo.test");
  for (const ctx of [client.ctx, provider]) {
    expect((await ctx.get("/api/admin/stats")).status()).toBe(403);
    expect((await ctx.post("/api/admin/orders/x/resolve", { data: { resolution: "release" } })).status()).toBe(403);
    expect((await ctx.patch("/api/admin/providers/x", { data: { action: "approve" } })).status()).toBe(403);
    expect((await ctx.patch("/api/admin/reviews/x", { data: { hidden: true } })).status()).toBe(403);
  }
  await client.ctx.dispose();
  await provider.dispose();
});
