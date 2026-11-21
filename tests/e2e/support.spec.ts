import { mkdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { test, expect, request, type Page } from "@playwright/test";
import { BASE, apiAs, registerApi, login, settled } from "./helpers";

/**
 * The Help button: a client or creator writes to the support team in a sheet, an admin answers in /admin/support, and the
 * person sees the answer (and a dot until they have). The owner's Telegram ping carries who, never what; it cannot be
 * heard in this suite (no Telegram settings), so the rule that decides when it is sent is in tests/unit/support.test.ts and
 * here we only check that it is claimed once per thread (`lastAlertAt`).
 */
const prisma = new PrismaClient();
const CLIENT_PASSWORD = "Passw0rd!x"; // what registerApi() uses

test.afterAll(async () => { await prisma.$disconnect(); });

/** With E2E_SHOTS=<dir>, saves a desktop and a phone picture of the page, to look at it. */
async function shot(page: Page, name: string) {
  const dir = process.env.E2E_SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const was = page.viewportSize();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: `${dir}/${name}-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${dir}/${name}-phone.png` });
  if (was) await page.setViewportSize(was);
}

test("who may use the support endpoints", async () => {
  const client = await registerApi("CLIENT");
  const admin = await apiAs("admin@demo.test");

  // A visitor is turned away; so is an admin (they answer from /admin/support); a client may write and read.
  const anon = await request.newContext({ baseURL: BASE });
  expect((await anon.get("/api/support")).status()).toBe(401);
  expect((await anon.post("/api/support", { data: { body: "hi" } })).status()).toBe(401);
  expect((await anon.get("/api/support/unread")).status()).toBe(401);
  expect((await admin.get("/api/support")).status()).toBe(403);
  expect((await admin.post("/api/support", { data: { body: "hi" } })).status()).toBe(403);
  expect((await client.ctx.get("/api/support")).status()).toBe(200);
  expect((await client.ctx.post("/api/support", { data: { body: "   " } })).status()).toBe(400); // empty after trimming
  expect((await client.ctx.post("/api/support", { data: { body: "x".repeat(1501) } })).status()).toBe(400);

  // The admin side is for admins only.
  const sent = await (await client.ctx.post("/api/support", { data: { body: "Salom, yordam kerak" } })).json();
  const thread = await prisma.supportThread.findFirstOrThrow({ where: { messages: { some: { id: sent.message.id } } } });
  expect((await client.ctx.get(`/api/admin/support/${thread.id}`)).status()).toBe(403);
  expect((await client.ctx.post(`/api/admin/support/${thread.id}`, { data: { body: "no" } })).status()).toBe(403);
  expect((await anon.get(`/api/admin/support/${thread.id}`)).status()).toBe(401);
  expect((await admin.get("/api/admin/support/does-not-exist")).status()).toBe(404);
  await anon.dispose();
});

test("one thread per person; the owner is pinged once per thread, not once per message", async () => {
  const client = await registerApi("CLIENT");
  const first = await client.ctx.post("/api/support", { data: { body: "Birinchi xabar" } });
  expect(first.status()).toBe(201);
  const thread = await prisma.supportThread.findFirstOrThrow({ where: { messages: { some: { id: (await first.json()).message.id } } } });
  expect(thread.lastAlertAt).not.toBeNull(); // the ping was claimed with the first message
  expect((await client.ctx.post("/api/support", { data: { body: "Ikkinchi xabar" } })).status()).toBe(201);
  const after = await prisma.supportThread.findUniqueOrThrow({ where: { id: thread.id } });
  expect(after.lastAlertAt!.getTime()).toBe(thread.lastAlertAt!.getTime()); // no second claim within 10 minutes
  expect(await prisma.supportThread.count({ where: { userId: thread.userId } })).toBe(1);
  expect(await prisma.supportMessage.count({ where: { threadId: thread.id } })).toBe(2);
});

test("a visitor sees Telegram and the way in, a client writes, an admin answers, the client reads the answer", async ({ browser }) => {
  test.setTimeout(120_000);

  // A visitor: the footer opens the sheet; there is the Telegram link and the way in, and no place to write.
  const visitorCtx = await browser.newContext();
  const visitor = await visitorCtx.newPage();
  await visitor.goto("/");
  await settled(visitor);
  await visitor.getByRole("contentinfo").getByRole("button", { name: "Yordam" }).click();
  const visitorSheet = visitor.getByRole("dialog", { name: "Yordam" });
  await expect(visitorSheet).toBeVisible();
  await expect(visitorSheet.getByRole("link", { name: "Telegramda yozish" })).toHaveAttribute("href", "https://t.me/justuzbe");
  await expect(visitorSheet.getByRole("link", { name: "Kirish" })).toBeVisible();
  await expect(visitorSheet.getByLabel("Xabar")).toHaveCount(0);
  await shot(visitor, "1-visitor");
  await visitor.keyboard.press("Escape");
  await expect(visitorSheet).toBeHidden();
  await visitorCtx.close();

  // A client writes through the account menu.
  const client = await registerApi("CLIENT");
  const clientCtx = await browser.newContext();
  const page = await clientCtx.newPage();
  await login(page, client.email, CLIENT_PASSWORD);
  await page.goto("/search");
  await settled(page);
  await page.getByRole("button", { name: /Hisob menyusi/ }).click();
  await page.getByRole("menuitem", { name: "Yordam" }).click();
  const sheet = page.getByRole("dialog", { name: "Yordam" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Savolingizni yozing, javobni shu yerda koʻrasiz.", { exact: true })).toBeVisible();
  await sheet.getByLabel("Xabar").fill("Salom! Buyurtmam haqida savolim bor.");
  await sheet.getByRole("button", { name: "Yuborish" }).click();
  await expect(sheet.getByTestId("support-from-user")).toContainText("Buyurtmam haqida savolim bor");
  await shot(page, "2-client-wrote");

  // Escape closes it; the page behind is as it was.
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // The admin finds the thread, marked as waiting, opens it and answers.
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, "admin@demo.test");
  await admin.goto("/admin/support");
  await settled(admin);
  const row = admin.getByTestId("support-thread").filter({ hasText: "Buyurtmam haqida savolim bor" });
  await expect(row).toBeVisible();
  await expect(row.getByText("Javob kutmoqda")).toBeVisible();
  await shot(admin, "3-admin-list");
  await row.click();
  await expect(admin.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(admin.getByTestId("support-from-user")).toContainText("Buyurtmam haqida savolim bor");
  await admin.getByLabel("Javob").fill("Salom! Buyurtma sahifasidagi Xabarlar tugmasidan yozing, yordam beramiz.");
  await admin.getByRole("button", { name: "Yuborish" }).click();
  await expect(admin.getByTestId("support-from-staff")).toContainText("yordam beramiz");
  await shot(admin, "4-admin-thread");

  // Answered: it no longer says "waiting" in the admin's list.
  await admin.goto("/admin/support");
  await expect(admin.getByTestId("support-thread").filter({ hasText: "yordam beramiz" }).getByText("Javob kutmoqda")).toHaveCount(0);

  // The client has a dot on the account button until they open the thread, and then the answer is in it.
  await page.reload();
  await settled(page);
  await expect(page.getByRole("button", { name: /Hisob menyusi/ }).getByText("Yangi javob bor")).toBeAttached();
  await page.getByRole("button", { name: /Hisob menyusi/ }).click();
  await page.getByRole("menuitem", { name: "Yordam" }).click();
  await expect(sheet.getByTestId("support-from-staff")).toContainText("yordam beramiz");
  await shot(page, "5-client-answer");
  await page.keyboard.press("Escape");
  await page.reload();
  await settled(page);
  await expect(page.getByRole("button", { name: /Hisob menyusi/ }).getByText("Yangi javob bor")).toHaveCount(0);

  // An admin has no Help item in their account menu: they answer from the inbox.
  await admin.getByRole("button", { name: /Hisob menyusi/ }).click();
  await expect(admin.getByRole("menuitem", { name: "Yordam" })).toHaveCount(0);

  await clientCtx.close();
  await adminCtx.close();
});
