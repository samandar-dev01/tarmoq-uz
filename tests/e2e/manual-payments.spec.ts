import { mkdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { apiAs, registerApi, jasurServiceId, goodBrief, login, settled, tinyMp4 } from "./helpers";

/**
 * Manual card-transfer mode (real money moved by hand). Runs only against a server started with
 *   PAYMENT_PROVIDER=manual MANUAL_PAY_CARD="8600 1234 5678 9012" MANUAL_PAY_HOLDER="TEST OWNER"
 * and is skipped otherwise, so the default `npm run test:e2e` (sandbox mode) is unaffected.
 * Set E2E_SHOTS=/some/dir to also save screenshots of the pages at desktop and phone width.
 */
test.skip(process.env.PAYMENT_PROVIDER !== "manual", "Manual mode is off: start the server with PAYMENT_PROVIDER=manual, MANUAL_PAY_CARD and MANUAL_PAY_HOLDER.");

const prisma = new PrismaClient();
test.afterAll(async () => {
  await prisma.$disconnect();
});

const CARD = process.env.MANUAL_PAY_CARD ?? "8600 1234 5678 9012";
const HOLDER = process.env.MANUAL_PAY_HOLDER ?? "TEST OWNER";
const CLIENT_PASSWORD = "Passw0rd!x"; // what registerApi() uses
// The smallest valid PNG (one pixel).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const receipt = (name = "chek.png") => ({ name, mimeType: "image/png", buffer: PNG });
const video = { name: "reel.mp4", mimeType: "video/mp4", buffer: tinyMp4 };

/** A fresh client and an order that is waiting for payment (agreed at 300 000 soʻm, so the creator's share is 270 000). */
async function orderAwaitingPayment() {
  const client = await registerApi("CLIENT");
  const jasur = await apiAs("jasur@demo.test");
  const serviceId = await jasurServiceId(client.ctx);
  const orderId = (await (await client.ctx.post("/api/orders", { data: { serviceId, brief: goodBrief } })).json()).order.id as string;
  const proposed = await (await jasur.post(`/api/orders/${orderId}/propose`, { data: { price: 300000, deliveryDays: 2, revisions: 1 } })).json();
  expect((await client.ctx.post(`/api/orders/${orderId}/agreement`, { data: { termsHash: proposed.agreement.termsHash, accept: true } })).status()).toBe(200);
  return { client, jasur, orderId };
}

const submit = (ctx: APIRequestContext, orderId: string, file?: { name: string; mimeType: string; buffer: Buffer }) =>
  ctx.post("/api/payments/manual/submit", { multipart: file ? { orderId, receipt: file } : { orderId } });

const paymentOf = (orderId: string, status: string) => prisma.payment.findFirstOrThrow({ where: { orderId, status: status as never } });

test.describe.configure({ mode: "serial" });

test("manual payment: the receipt is required, an admin confirms, the order runs, the creator is paid by hand", async () => {
  const { client, jasur, orderId } = await orderAwaitingPayment();
  const admin = await apiAs("admin@demo.test");
  const other = await registerApi("CLIENT");

  // Test cards are off in this mode.
  expect((await client.ctx.post("/api/payments/sandbox/intent", { data: { orderId } })).status()).toBe(404);

  // The receipt is required, and it must really be an image or a PDF within the size limit.
  expect((await submit(client.ctx, orderId)).status()).toBe(400); // no file at all
  expect((await submit(client.ctx, orderId, { name: "chek.png", mimeType: "image/png", buffer: Buffer.alloc(0) })).status()).toBe(400); // empty
  const disguised = await submit(client.ctx, orderId, { name: "chek.png", mimeType: "image/png", buffer: Buffer.from("MZ this is a program, not a picture") });
  expect(disguised.status()).toBe(400);
  expect((await disguised.json()).error).toMatch(/JPG, PNG, WebP/);
  const svg = await submit(client.ctx, orderId, { name: "chek.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
  expect(svg.status()).toBe(400);
  expect((await submit(client.ctx, orderId, { name: "big.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]) })).status()).toBe(413);
  expect((await submit(client.ctx, orderId, { name: "huge.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]) })).status()).toBe(413);
  expect(await prisma.payment.count({ where: { orderId } })).toBe(0); // none of those created a payment

  // Only the order's own client may submit.
  expect((await submit(other.ctx, orderId, receipt())).status()).toBe(404);
  expect((await submit(jasur, orderId, receipt())).status()).toBe(403);
  expect(await prisma.payment.count({ where: { orderId } })).toBe(0);

  // A real receipt: the payment waits for an admin. Pressing twice changes nothing.
  expect((await submit(client.ctx, orderId, receipt())).status()).toBe(200);
  expect((await submit(client.ctx, orderId, receipt("again.png"))).status()).toBe(200);
  const payments = await prisma.payment.findMany({ where: { orderId } });
  expect(payments).toHaveLength(1);
  const waiting = payments[0]!;
  expect(waiting).toMatchObject({ status: "AWAITING_CONFIRMATION", provider: "manual", amount: 300000, receiptType: "image/png", receiptName: "chek.png" });
  expect(waiting.receiptKey).toMatch(/^receipts\/.+\.png$/); // named from the real bytes, not from the client's file name
  const orderRow = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  expect(orderRow.status).toBe("AWAITING_PAYMENT"); // nothing has started yet

  // While it waits: no work can be delivered, and the order cannot be cancelled (that would strand the money).
  expect((await jasur.post(`/api/orders/${orderId}/delivery`, { multipart: { file: video } })).status()).toBe(409);
  const cancel = await client.ctx.post(`/api/orders/${orderId}/cancel`, { data: {} });
  expect(cancel.status()).toBe(409);
  expect((await cancel.json()).error).toMatch(/tekshirilmoqda/);

  // The receipt is for admins only.
  const receiptUrl = `/api/admin/payments/${waiting.id}/receipt`;
  expect([401, 403]).toContain((await client.ctx.get(receiptUrl)).status());
  expect([401, 403]).toContain((await jasur.get(receiptUrl)).status());
  const shown = await admin.get(receiptUrl);
  expect(shown.status()).toBe(200);
  expect(shown.headers()["content-type"]).toBe("image/png");
  expect(shown.headers()["x-content-type-options"]).toBe("nosniff");
  expect(shown.headers()["content-security-policy"]).toContain("sandbox");
  expect(Buffer.compare(await shown.body(), PNG)).toBe(0);

  // Only an admin can decide.
  expect((await client.ctx.patch(`/api/admin/payments/${waiting.id}`, { data: { action: "confirm" } })).status()).toBe(403);
  expect((await jasur.patch(`/api/admin/payments/${waiting.id}`, { data: { action: "confirm" } })).status()).toBe(403);

  // Admin rejects: the payment fails, the order stays open and the client can submit again with a new receipt.
  expect((await admin.patch(`/api/admin/payments/${waiting.id}`, { data: { action: "reject" } })).status()).toBe(200);
  expect(await prisma.payment.findUniqueOrThrow({ where: { id: waiting.id } })).toMatchObject({ status: "FAILED", failureCode: "not_received" });
  expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("AWAITING_PAYMENT");
  expect((await admin.patch(`/api/admin/payments/${waiting.id}`, { data: { action: "reject" } })).status()).toBe(409); // already decided
  expect((await submit(client.ctx, orderId, receipt("second.png"))).status()).toBe(200);
  const second = await paymentOf(orderId, "AWAITING_CONFIRMATION");
  expect(second.id).not.toBe(waiting.id);

  // Admin confirms: the money is held and the order starts, exactly once.
  expect((await admin.patch(`/api/admin/payments/${second.id}`, { data: { action: "confirm" } })).status()).toBe(200);
  expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("IN_PROGRESS");
  expect(await prisma.payment.findUniqueOrThrow({ where: { id: second.id } })).toMatchObject({ status: "HELD", amount: 300000 });
  expect(await prisma.ledgerEntry.findMany({ where: { paymentId: second.id } })).toEqual([expect.objectContaining({ type: "ESCROW_HOLD", amount: 300000 })]);
  expect((await admin.patch(`/api/admin/payments/${second.id}`, { data: { action: "confirm" } })).status()).toBe(409);
  expect((await submit(client.ctx, orderId, receipt())).status()).toBe(409); // nothing left to pay

  // The creator delivers; the client approves; the creator's share becomes a pending payout (270 000 = 300 000 minus the 30 000 fee).
  expect((await jasur.post(`/api/orders/${orderId}/delivery`, { multipart: { file: video } })).status()).toBe(201);
  expect((await client.ctx.post(`/api/orders/${orderId}/approve`)).status()).toBe(200);
  const ledger = await prisma.ledgerEntry.findMany({ where: { paymentId: second.id } });
  expect(ledger.find((l) => l.type === "PROVIDER_PAYOUT")?.amount).toBe(270000);
  expect(ledger.find((l) => l.type === "PLATFORM_FEE")?.amount).toBe(30000);
  const payout = await prisma.payout.findUniqueOrThrow({ where: { paymentId: second.id } });
  expect(payout).toMatchObject({ status: "PENDING", amount: 270000 });

  // The creator saves a payout card: a typo is refused, a good number is stored encrypted.
  const typo = await jasur.put("/api/profile/payout", { data: { holder: "JASUR KARIMOV", cardNumber: "4111 1111 1111 1112" } });
  expect(typo.status()).toBe(400);
  expect(JSON.stringify(await typo.json())).toMatch(/cardNumber/);
  expect((await client.ctx.put("/api/profile/payout", { data: { holder: "X Y Z", cardNumber: "4111111111111111" } })).status()).toBe(403); // not a creator
  expect((await jasur.put("/api/profile/payout", { data: { holder: "JASUR KARIMOV", cardNumber: "4111 1111 1111 1111" } })).status()).toBe(200);
  const profile = await prisma.providerProfile.findFirstOrThrow({ where: { user: { email: "jasur@demo.test" } } });
  expect(profile).toMatchObject({ payoutHolder: "JASUR KARIMOV", payoutCardLast4: "1111" });
  expect(profile.payoutCardEnc).toBeTruthy();
  expect(profile.payoutCardEnc).not.toContain("4111");

  // Only the admin page shows the whole number, and only an admin can mark the payout sent.
  expect([401, 403, 302, 307]).toContain((await client.ctx.get("/admin/payouts", { maxRedirects: 0 })).status());
  const html = await (await admin.get("/admin/payouts")).text();
  expect(html).toContain("4111 1111 1111 1111");
  expect(html).toContain("JASUR KARIMOV");
  expect((await jasur.post(`/api/admin/payouts/${payout.id}`)).status()).toBe(403);
  expect((await admin.post(`/api/admin/payouts/${payout.id}`)).status()).toBe(200);
  expect((await admin.post(`/api/admin/payouts/${payout.id}`)).status()).toBe(409); // marked once
  expect(await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } })).toMatchObject({ status: "PAID", paidById: expect.any(String) });

  // The creator's page never exposes the number (only the last four digits).
  const dash = await (await jasur.get("/dashboard/provider")).text();
  expect(dash).not.toContain("4111 1111 1111 1111");
  expect(dash).toContain("1111");

  for (const c of [client.ctx, other.ctx, jasur, admin]) await c.dispose();
});

const SHOTS = process.env.E2E_SHOTS;
async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const desktop = page.viewportSize();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: `${SHOTS}/${name}-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${SHOTS}/${name}-phone.png`, fullPage: true });
  if (desktop) await page.setViewportSize(desktop);
}

test("manual payment through the real pages: checkout, waiting, admin confirm, payout", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const { client, jasur, orderId } = await orderAwaitingPayment();
  await login(page, client.email, CLIENT_PASSWORD);

  // Checkout: the transfer details, and the button is off until a receipt is chosen.
  await page.goto(`/checkout/${orderId}`);
  await settled(page);
  await expect(page.getByText(CARD)).toBeVisible();
  await expect(page.getByText(HOLDER)).toBeVisible();
  await expect(page.getByText(/300\D000\Dso.m/).first()).toBeVisible();
  await expect(page.getByText("Izoh kodi (oʻtkazma izohiga yozing)")).toBeVisible();
  // Real money moves in this mode, so no page may claim that payments are a test.
  await expect(page.getByText(/sinov rejimi/i)).toHaveCount(0);
  const pay =page.getByRole("button", { name: "Men toʻladim" });
  await expect(pay).toBeDisabled();
  await shot(page, "1-checkout");

  // A file that is too big is refused in the browser, before anything is uploaded.
  await page.getByLabel("Toʻlov cheki").setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 10) });
  await expect(page.getByText("Fayl juda katta (eng koʻpi 5 MB).")).toBeVisible();
  await expect(pay).toBeDisabled();
  await shot(page, "2-checkout-too-big");

  // A real receipt turns the button on; pressing it moves to the waiting state.
  await page.getByLabel("Toʻlov cheki").setInputFiles(receipt());
  await expect(pay).toBeEnabled();
  await pay.click();
  await expect(page.getByText("Toʻlovingiz tekshirilmoqda.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Men toʻladim" })).toHaveCount(0);
  await shot(page, "3-checkout-waiting");

  // The order page tells the client the same thing and offers no second payment button.
  await page.goto(`/orders/${orderId}`);
  await expect(page.getByText("Toʻlovingiz tekshirilmoqda.")).toBeVisible();
  await expect(page.getByText("Keyingi qadam: Administrator toʻlovni tasdiqlashini kuting")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Toʻlash$|Xavfsiz toʻlash/ })).toHaveCount(0);
  await expect(page.getByText(/sinov rejimi/i)).toHaveCount(0);
  await shot(page, "4-order-awaiting");

  // The admin sees the receipt link and confirms.
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  adminPage.on("dialog", (d) => void d.accept());
  await login(adminPage, "admin@demo.test");
  await adminPage.goto("/admin/payments");
  await settled(adminPage);
  const row = adminPage.locator("div.rounded-card", { has: adminPage.locator(`a[href="/orders/${orderId}"]`) });
  await expect(row.getByText("Tekshirilmoqda", { exact: true })).toBeVisible();
  await expect(row.getByRole("link", { name: "Chekni ochish" })).toBeVisible();
  const receiptHref = await row.getByRole("link", { name: "Chekni ochish" }).getAttribute("href");
  expect((await adminCtx.request.get(receiptHref!)).status()).toBe(200);
  await shot(adminPage, "5-admin-payments");
  await row.getByRole("button", { name: "Pul tushdi, tasdiqlash" }).click();
  await expect(adminPage.locator("div.rounded-card", { has: adminPage.locator(`a[href="/orders/${orderId}"]`) })).toHaveCount(0);

  await page.reload();
  await settled(page);
  await expect(page.getByTestId("order-status")).toHaveText("Jarayonda");

  // The creator saves a payout card on the dashboard through the form.
  const providerCtx = await browser.newContext();
  const provider = await providerCtx.newPage();
  await login(provider, "jasur@demo.test");
  await provider.goto("/dashboard/provider");
  await settled(provider);
  await provider.getByLabel("Karta egasi").fill("JASUR KARIMOV");
  await provider.getByLabel("Karta raqami").fill("4242 4242 4242 4241"); // fails the check digit
  await provider.getByRole("button", { name: /Kartani (saqlash|yangilash)/ }).click();
  await expect(provider.getByText("Karta raqamini toʻgʻri kiriting (16 ta raqam)")).toBeVisible();
  await shot(provider, "6-provider-card-error");
  await provider.getByLabel("Karta raqami").fill("5555 5555 5555 4444");
  await provider.getByRole("button", { name: /Kartani (saqlash|yangilash)/ }).click();
  await expect(provider.getByText("Karta saqlandi.")).toBeVisible();
  await expect(provider.getByText("•••• •••• •••• 4444")).toBeVisible();
  await shot(provider, "7-provider-card-saved");

  // Delivery and approval create a pending payout; the admin sees the card and marks it sent.
  expect((await jasur.post(`/api/orders/${orderId}/delivery`, { multipart: { file: video } })).status()).toBe(201);
  expect((await client.ctx.post(`/api/orders/${orderId}/approve`)).status()).toBe(200);
  await provider.reload();
  await settled(provider);
  await expect(provider.getByText(/Hozir oʻtkazilishi kutilayotgan/)).toBeVisible();
  await shot(provider, "8-provider-dashboard-owed");

  await adminPage.goto("/admin/payouts");
  await settled(adminPage);
  const payoutRow = adminPage.locator("div.rounded-card", { has: adminPage.locator(`a[href="/orders/${orderId}"]`) });
  await expect(payoutRow.getByText("5555 5555 5555 4444")).toBeVisible();
  await expect(payoutRow.getByText("Kutilmoqda")).toBeVisible();
  await shot(adminPage, "9-admin-payouts-pending");
  await payoutRow.getByRole("button", { name: "Oʻtkazdim" }).click();
  await expect(payoutRow.getByText(/Oʻtkazildi: /)).toBeVisible();
  await shot(adminPage, "10-admin-payouts-paid");

  // The creator's order page now shows when the money was sent.
  await provider.goto(`/orders/${orderId}`);
  await expect(provider.getByText(/Oʻtkazildi: /)).toBeVisible();
  await shot(provider, "11-provider-order-paid");

  await adminCtx.close();
  await providerCtx.close();
  await client.ctx.dispose();
  await jasur.dispose();
});
