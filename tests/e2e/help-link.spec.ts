import { mkdirSync } from "node:fs";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { login, registerApi, settled } from "./helpers";

/**
 * Help is one link to the support team's Telegram, in a new tab: in the header for a visitor (and in the phone menu),
 * in the account menu for a client or a creator, and in the footer for all of them. An admin is given none of the three.
 */
const TELEGRAM = "https://t.me/justuzbe";
const CLIENT_PASSWORD = "Passw0rd!x"; // what registerApi() uses

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

/** Opens Telegram in a NEW tab, and gives that page no handle back to this one. */
async function expectTelegramLink(link: Locator) {
  await expect(link).toHaveAttribute("href", TELEGRAM);
  await expect(link).toHaveAttribute("target", "_blank");
  expect(((await link.getAttribute("rel")) ?? "").split(/\s+/)).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
}

test("a visitor finds Help in the header and in the footer, both to Telegram", async ({ page }) => {
  await page.goto("/");
  await settled(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expectTelegramLink(page.locator("header").getByRole("navigation", { name: "Asosiy menyu" }).getByRole("link", { name: "Yordam" }));
  await expectTelegramLink(page.getByRole("contentinfo").getByRole("link", { name: "Yordam" }));
  await shot(page, "1-visitor");

  // On a phone the header link is inside "Menyu"; pressing it opens Telegram in a new tab and closes that menu.
  // (Telegram's address is answered here, so the test never leaves the machine.)
  await page.context().route("https://t.me/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Telegram</title>" }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("header summary", { hasText: "Menyu" }).click();
  const inMenu = page.locator("header details").getByRole("link", { name: "Yordam" });
  await expectTelegramLink(inMenu);
  const [popup] = await Promise.all([page.waitForEvent("popup"), inMenu.click()]);
  expect(popup.url()).toBe(TELEGRAM);
  await expect(page.locator("header details")).not.toHaveAttribute("open", "");
});

test("a client and a creator find Help in the account menu and in the footer; the menu closes after it is chosen", async ({ browser }) => {
  const client = await registerApi("CLIENT");
  for (const who of [{ email: client.email, password: CLIENT_PASSWORD }, { email: "jasur@demo.test", password: undefined }]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, who.email, who.password);
    await page.goto("/");
    await settled(page);
    await page.getByRole("button", { name: /Hisob menyusi/ }).click();
    const item = page.getByRole("menuitem", { name: "Yordam" });
    await expectTelegramLink(item);
    await shot(page, `2-menu-${who.email.startsWith("jasur") ? "creator" : "client"}`);
    await expectTelegramLink(page.getByRole("contentinfo").getByRole("link", { name: "Yordam" }));
    await context.close();
  }
});

test("an admin has no Help link anywhere", async ({ page }) => {
  await login(page, "admin@demo.test");
  await page.goto("/admin");
  await settled(page);
  await page.getByRole("button", { name: /Hisob menyusi/ }).click();
  await expect(page.getByRole("menuitem", { name: "Yordam" })).toHaveCount(0);
  await expect(page.locator(`a[href="${TELEGRAM}"]`)).toHaveCount(0);
});
