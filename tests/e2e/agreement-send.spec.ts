import { mkdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { test, expect, type Page } from "@playwright/test";
import { apiAs, registerApi, jasurServiceId, goodBrief, login, settled } from "./helpers";

/**
 * Sending the terms ("kelishuv"): the creator cannot send them endlessly, and the client sees a short offer, not a document.
 * The rules live on the server (src/app/api/orders/[id]/propose/route.ts); the page only folds the form away.
 */
const prisma = new PrismaClient();
const CLIENT_PASSWORD = "Passw0rd!x"; // what registerApi() uses

async function newOrder() {
  const client = await registerApi("CLIENT");
  const jasur = await apiAs("jasur@demo.test");
  const serviceId = await jasurServiceId(client.ctx);
  const orderId = (await (await client.ctx.post("/api/orders", { data: { serviceId, brief: goodBrief } })).json()).order.id as string;
  return { client, jasur, orderId };
}

test.afterAll(async () => { await prisma.$disconnect(); });

/** With E2E_SHOTS=<dir>, saves a desktop and a phone picture of the page, to look at it. */
async function shot(page: Page, name: string) {
  const dir = process.env.E2E_SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const was = page.viewportSize();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: `${dir}/${name}-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${dir}/${name}-phone.png`, fullPage: true });
  if (was) await page.setViewportSize(was);
}

test("terms can be sent three times at most, and never the same twice in a row", async () => {
  const { jasur, orderId } = await newOrder();
  const send = (data: Record<string, unknown>) => jasur.post(`/api/orders/${orderId}/propose`, { data });
  const first = { price: 300000, deliveryDays: 2, revisions: 1 };

  expect((await send(first)).status()).toBe(201);
  const same = await send(first); // a double tap, a second tab
  expect(same.status()).toBe(409);
  expect(JSON.stringify(await same.json())).toContain("allaqachon yuborilgan");
  expect((await send({ ...first, notes: "Ikki joy" })).status()).toBe(201); // only the note changed: that is a change (version 2)
  expect((await send({ ...first, notes: "Ikki joy" })).status()).toBe(409); // and again the same
  expect((await send({ ...first, price: 320000 })).status()).toBe(201); // version 3
  const fourth = await send({ ...first, price: 330000 });
  expect(fourth.status()).toBe(409);
  expect(JSON.stringify(await fourth.json())).toContain("3 marta");

  // Three versions and three messages in the client's chat, not more.
  expect(await prisma.agreement.count({ where: { orderId } })).toBe(3);
  expect(await prisma.message.count({ where: { conversation: { orderId }, body: { startsWith: "Shartlarni yubordim" } } })).toBe(3);
});

test("the creator sees a 'sent' state, not the form again; the client sees a short offer with the long text folded", async ({ browser }) => {
  test.setTimeout(120_000);
  const { client, orderId } = await newOrder();
  const providerCtx = await browser.newContext();
  const provider = await providerCtx.newPage();
  await login(provider, "jasur@demo.test");
  await provider.goto(`/orders/${orderId}`);
  await settled(provider);

  // The first send goes through the form, and the form does not come back.
  await provider.getByRole("button", { name: "Shartlarni mijozga yuborish" }).click();
  await expect(provider.getByRole("heading", { name: "Shartlaringiz mijozga yuborildi" })).toBeVisible();
  await expect(provider.getByRole("button", { name: "Shartlarni mijozga yuborish" })).toHaveCount(0);
  await expect(provider.getByRole("button", { name: "Shartlarni oʻzgartirish (2 ta qoldi)" })).toBeVisible();

  // The agreement is an offer: the price and two short facts. The eleven clauses are folded until someone asks.
  await expect(provider.getByRole("heading", { name: "Kelishuv (1-versiya)" })).toBeVisible();
  await expect(provider.getByText(/^\d+ kunda topshiriladi$/)).toBeVisible();
  await expect(provider.getByText(/^\d+ ta tuzatish$/)).toBeVisible();
  await expect(provider.getByTestId("agreement-uz")).toBeHidden();
  await shot(provider, "1-creator-sent");
  await provider.getByText("Toʻliq shartlar matni", { exact: true }).click();
  await expect(provider.getByTestId("agreement-uz")).toBeVisible();
  await expect(provider.getByTestId("agreement-uz")).toContainText("XIZMAT KOʻRSATISH KELISHUVI (1-versiya)");

  // Changing is a deliberate step with the number of changes left; "Bekor qilish" folds it again with nothing sent.
  await provider.getByRole("button", { name: "Shartlarni oʻzgartirish (2 ta qoldi)" }).click();
  await provider.getByRole("button", { name: "Bekor qilish", exact: true }).click(); // exact: the page also has "Buyurtmani bekor qilish"
  await expect(provider.getByRole("button", { name: "Shartlarni oʻzgartirish (2 ta qoldi)" })).toBeVisible();
  expect(await prisma.agreement.count({ where: { orderId } })).toBe(1);

  // Two changes use the allowance up: then the creator is told so, and there is no way to send more.
  for (const [left, price, version] of [[2, "350000", 2], [1, "360000", 3]] as const) {
    await provider.getByRole("button", { name: `Shartlarni oʻzgartirish (${left} ta qoldi)` }).click();
    await provider.getByLabel("Narx (soʻm)").fill(price);
    await provider.getByRole("button", { name: "Yangilangan shartlarni yuborish" }).click();
    await expect(provider.getByRole("heading", { name: `Kelishuv (${version}-versiya)` })).toBeVisible();
  }
  await expect(provider.getByText(/Shartlarni boshqa oʻzgartirib boʻlmaydi \(eng koʻpi 3 marta\)/)).toBeVisible();
  await expect(provider.getByRole("button", { name: /Shartlarni oʻzgartirish/ })).toHaveCount(0);
  expect(await prisma.agreement.count({ where: { orderId } })).toBe(3);

  // The client sees the latest offer, short, with the long text folded, and accepts as before.
  const clientCtx = await browser.newContext();
  const page = await clientCtx.newPage();
  await login(page, client.email, CLIENT_PASSWORD);
  await page.goto(`/orders/${orderId}`);
  await settled(page);
  await expect(page.getByRole("heading", { name: "Kelishuv (3-versiya)" })).toBeVisible();
  await expect(page.getByText(/360\D000\Dso.m/).first()).toBeVisible();
  await expect(page.getByTestId("agreement-uz")).toBeHidden();
  await shot(page, "2-client-offer");
  await page.getByText("Toʻliq shartlar matni", { exact: true }).click();
  await shot(page, "3-client-offer-open");
  await page.getByLabel("Shartlar bilan tanishib chiqdim va qabul qilaman").check();
  await page.getByRole("button", { name: "Kelishuvni qabul qilish" }).click();
  await expect(page.getByTestId("order-status")).toHaveText("Toʻlov kutilmoqda");
  await providerCtx.close();
  await clientCtx.close();
});
