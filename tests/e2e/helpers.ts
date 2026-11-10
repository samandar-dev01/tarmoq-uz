import { request as pwRequest, expect, type APIRequestContext, type Page } from "@playwright/test";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Demo12345!";

/**
 * Waits until React is live on the page (the app sets data-hydrated on <html>). After a full page load in dev mode this
 * takes a moment, and anything typed or clicked before then is lost. Call it after goto() and reload() before interacting.
 */
export async function settled(page: Page) {
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "true");
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await settled(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parol").fill(password);
  await page.getByRole("button", { name: "Kirish" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** API client that is already signed in as a seeded demo user. */
export async function apiAs(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  if (!res.ok()) throw new Error(`Login failed for ${email}: HTTP ${res.status()}`);
  return ctx;
}

/** Registers a brand-new user through the API and returns a signed-in client. */
export async function registerApi(role: "CLIENT" | "PROVIDER") {
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`;
  const res = await ctx.post("/api/auth/register", { data: { name: "E2E Tester", email, password: "Passw0rd!x", role } });
  if (!res.ok()) throw new Error(`Register failed: HTTP ${res.status()}`);
  return { ctx, email };
}

/** Finds the id of Jasur's cheapest package from his public profile page. */
export async function jasurServiceId(ctx: APIRequestContext): Promise<string> {
  const html = await (await ctx.get("/providers/jasur-karimov")).text();
  const m = /orders\/new\?service=([a-z0-9]+)/.exec(html.replace(/%2F/gi, "/").replace(/%3F/gi, "?").replace(/%3D/gi, "="));
  if (!m) throw new Error("Could not find a package id on Jasur's profile. Did you run the seed?");
  return m[1]!;
}

export const goodBrief = "Keyingi hafta ochiladigan kafem uchun subtitrli, 45 soniyalik vertikal reel kerak.";
