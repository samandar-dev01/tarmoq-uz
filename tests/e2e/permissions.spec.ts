import { test, expect } from "@playwright/test";
import { apiAs, registerApi, jasurServiceId, goodBrief, login } from "./helpers";

test.describe("anonymous visitors", () => {
  test("cannot call protected APIs", async ({ request }) => {
    expect((await request.get("/api/admin/stats")).status()).toBe(401);
    expect((await request.get("/api/conversations")).status()).toBe(401);
    expect((await request.post("/api/orders", { data: {} })).status()).toBe(401);
    expect((await request.put("/api/profile", { data: { step: 1 } })).status()).toBe(401);
    expect((await request.post("/api/payments/sandbox/intent", { data: { orderId: "x" } })).status()).toBe(401);
  });

  test("are redirected to sign in from protected pages", async ({ page }) => {
    for (const path of ["/admin", "/dashboard/client", "/dashboard/provider", "/messages", "/orders/new"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("can browse public pages", async ({ page }) => {
    await page.goto("/search?city=Andijan");
    await expect(page.getByText("Jasur Karimov")).toBeVisible();
    // pending and non-Andijan providers are not listed
    await expect(page.getByText("Dilshod Rahimov")).toHaveCount(0);
  });
});

test.describe("role boundaries", () => {
  test("a client cannot use admin or provider endpoints", async () => {
    const client = await apiAs("client@demo.test");
    expect((await client.get("/api/admin/stats")).status()).toBe(403);
    expect((await client.patch("/api/admin/providers/any", { data: { action: "approve" } })).status()).toBe(403);
    expect((await client.patch("/api/admin/reviews/any", { data: { hidden: true } })).status()).toBe(403);
    expect((await client.post("/api/admin/orders/any/resolve", { data: { resolution: "refund" } })).status()).toBe(403);
    expect((await client.put("/api/profile", { data: { step: 1 } })).status()).toBe(403);
    await client.dispose();
  });

  test("a provider cannot use admin endpoints or create orders", async () => {
    const provider = await apiAs("jasur@demo.test");
    expect((await provider.get("/api/admin/stats")).status()).toBe(403);
    expect((await provider.patch("/api/admin/providers/any", { data: { action: "approve" } })).status()).toBe(403);
    expect((await provider.post("/api/orders", { data: { serviceId: "x", brief: goodBrief } })).status()).toBe(403);
    expect((await provider.post("/api/payments/sandbox/intent", { data: { orderId: "x" } })).status()).toBe(403);
    await provider.dispose();
  });

  test("an admin can read stats, and cannot self-register", async ({ request }) => {
    const admin = await apiAs("admin@demo.test");
    const stats = await admin.get("/api/admin/stats");
    expect(stats.status()).toBe(200);
    expect(typeof (await stats.json()).escrowHeld).toBe("number");
    await admin.dispose();

    const res = await request.post("/api/auth/register", { data: { name: "Mallory", email: `m-${Date.now()}@example.test`, password: "Passw0rd!x", role: "ADMIN" } });
    expect(res.status()).toBe(400);
  });

  test("admin pages are forbidden for a signed-in client and provider", async ({ page, browser }) => {
    await login(page, "client@demo.test");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/forbidden/);
    await page.goto("/admin/providers");
    await expect(page).toHaveURL(/\/forbidden/);

    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await login(p2, "madina@demo.test");
    await p2.goto("/admin/orders");
    await expect(p2).toHaveURL(/\/forbidden/);
    await p2.goto("/dashboard/client");
    await expect(p2).toHaveURL(/\/forbidden/);
    await ctx.close();
  });
});

test.describe("order access and workflow permissions", () => {
  test("only the people on an order can see or act on it, and each role can only do its own steps", async () => {
    const owner = await registerApi("CLIENT");
    const stranger = await registerApi("CLIENT");
    const jasur = await apiAs("jasur@demo.test");
    const madina = await apiAs("madina@demo.test");

    const serviceId = await jasurServiceId(owner.ctx);
    const created = await owner.ctx.post("/api/orders", { data: { serviceId, brief: goodBrief } });
    expect(created.status()).toBe(201);
    const orderId = (await created.json()).order.id as string;

    // strangers get 404, never a hint that the order exists
    expect((await stranger.ctx.get(`/orders/${orderId}`)).status()).toBe(404);
    expect((await stranger.ctx.post(`/api/orders/${orderId}/cancel`, { data: {} })).status()).toBe(404);
    expect((await madina.post(`/api/orders/${orderId}/propose`, { data: { price: 300000, deliveryDays: 2, revisions: 1 } })).status()).toBe(404);

    // wrong role for the step
    expect((await owner.ctx.post(`/api/orders/${orderId}/propose`, { data: { price: 1, deliveryDays: 1, revisions: 0 } })).status()).toBe(403);
    expect((await jasur.post(`/api/orders/${orderId}/approve`)).status()).toBe(403);
    expect((await jasur.post(`/api/orders/${orderId}/agreement`, { data: { termsHash: "a".repeat(64), accept: true } })).status()).toBe(403);

    // right role, but state does not allow it yet
    expect((await owner.ctx.post(`/api/orders/${orderId}/approve`)).status()).toBe(409);
    expect((await owner.ctx.post("/api/payments/sandbox/intent", { data: { orderId } })).status()).toBe(409);
    expect((await owner.ctx.post(`/api/orders/${orderId}/agreement`, { data: { termsHash: "a".repeat(64), accept: true } })).status()).toBe(409);
    expect((await owner.ctx.post(`/api/orders/${orderId}/review`, { data: { rating: 5, comment: "Great work, thank you!" } })).status()).toBe(409);

    // provider proposes; a stale/wrong hash can never be accepted
    const proposed = await jasur.post(`/api/orders/${orderId}/propose`, { data: { price: 300000, deliveryDays: 2, revisions: 1 } });
    expect(proposed.status()).toBe(201);
    expect((await owner.ctx.post(`/api/orders/${orderId}/agreement`, { data: { termsHash: "a".repeat(64), accept: true } })).status()).toBe(409);

    // cancel works before payment, and then everything else is closed
    expect((await owner.ctx.post(`/api/orders/${orderId}/cancel`, { data: {} })).status()).toBe(200);
    expect((await owner.ctx.post(`/api/orders/${orderId}/cancel`, { data: {} })).status()).toBe(409);

    for (const c of [owner.ctx, stranger.ctx, jasur, madina]) await c.dispose();
  });

  test("a stranger cannot message in someone else's conversation", async () => {
    const owner = await registerApi("CLIENT");
    const stranger = await registerApi("CLIENT");
    const serviceId = await jasurServiceId(owner.ctx);
    const created = await owner.ctx.post("/api/orders", { data: { serviceId, brief: goodBrief } });
    const orderId = (await created.json()).order.id as string;

    const list = await (await owner.ctx.get("/api/conversations")).json();
    const conv = list.conversations.find((c: { orderId: string }) => c.orderId === orderId);
    expect(conv).toBeTruthy();

    expect((await owner.ctx.get(`/api/conversations/${conv.id}/messages`)).status()).toBe(200);
    expect((await stranger.ctx.get(`/api/conversations/${conv.id}/messages`)).status()).toBe(404);
    expect((await stranger.ctx.post(`/api/conversations/${conv.id}/messages`, { data: { body: "hi" } })).status()).toBe(404);
    expect((await owner.ctx.post(`/api/conversations/${conv.id}/messages`, { data: { body: "Hello!" } })).status()).toBe(201);
    expect((await owner.ctx.post(`/api/conversations/${conv.id}/messages`, { data: { body: "   " } })).status()).toBe(400);

    await owner.ctx.dispose();
    await stranger.ctx.dispose();
  });
});
