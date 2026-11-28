import { expect, request, test } from "@playwright/test";
import { totpCode } from "../../src/lib/totp";
import { BASE, login, registerApi, settled } from "./helpers";

// The settings page: a new password ends every other session but not this one, and the old password stops working.
test("a new password signs out other devices and keeps this one", async ({ page }) => {
  const other = await registerApi("CLIENT");
  await login(page, other.email, "Passw0rd!x");
  await page.goto("/settings");
  await settled(page);
  await page.locator("#password-current").fill("Passw0rd!x");
  await page.getByLabel("Yangi parol", { exact: true }).fill("Passw0rd!yangi");
  await page.getByLabel("Yangi parolni takrorlang").fill("Passw0rd!yangi");
  await page.getByRole("button", { name: "Parolni oʻzgartirish" }).click();
  await expect(page.getByText("Parol oʻzgartirildi.")).toBeVisible();
  expect((await other.ctx.get("/api/auth/me")).status()).toBe(401);
  expect((await page.request.get("/api/auth/me")).status()).toBe(200);
});

test("a file that is not a picture is refused as a photo", async () => {
  const { ctx } = await registerApi("CLIENT");
  const res = await ctx.post("/api/account/avatar", { multipart: { photo: { name: "me.png", mimeType: "image/png", buffer: Buffer.from("not a picture") } } });
  expect(res.status()).toBe(400);
});

test("a signed-out visitor is sent to sign in", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login/);
});

// Two-step sign-in: once on, the password alone starts no session.
test("two-step sign-in asks for the authenticator code", async () => {
  const me = await registerApi("CLIENT");
  const setup = await me.ctx.post("/api/account/two-factor", { data: { action: "setup", currentPassword: "Passw0rd!x" } });
  expect(setup.status()).toBe(200);
  const { secret } = (await setup.json()) as { secret: string };
  expect((await me.ctx.post("/api/account/two-factor", { data: { action: "enable", code: totpCode(secret) } })).status()).toBe(200);

  const fresh = await request.newContext({ baseURL: BASE });
  const withoutCode = await fresh.post("/api/auth/login", { data: { email: me.email, password: "Passw0rd!x" } });
  expect(withoutCode.status()).toBe(401);
  expect((await fresh.get("/api/auth/me")).status()).toBe(401);
  expect((await fresh.post("/api/auth/login", { data: { email: me.email, password: "Passw0rd!x", code: totpCode(secret) } })).status()).toBe(200);
  await fresh.dispose();
});
