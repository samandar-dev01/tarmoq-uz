import { expect, test } from "@playwright/test";

/**
 * "Continue with Google". Google itself can not be driven from a test, so this covers the site's side: where the button
 * shows (and does not), where it sends the person, and what the sign-in page says when Google sends them back.
 *
 *   Default server (no Google keys): the button must not exist anywhere.
 *   E2E_GOOGLE_KEYS=1 (run the server with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set, to any made-up values):
 *   the button must be there, on the right doors, and lead to Google's account chooser.
 * The code that checks Google's answer is covered by tests/unit/googleAuth.test.ts and googleRoutes.test.ts.
 */
const KEYS = process.env.E2E_GOOGLE_KEYS === "1";
const BUTTON = "Google orqali davom etish";

test.describe("without the Google keys", () => {
  test.skip(KEYS, "the server runs with Google keys");

  test("no page shows a Google button", async ({ page }) => {
    for (const path of ["/login?role=client", "/login?role=provider", "/register?role=client", "/register?role=provider"]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "Kirish" }).or(page.getByRole("button", { name: "Roʻyxatdan oʻtish" }))).toBeVisible();
      await expect(page.getByRole("link", { name: BUTTON })).toHaveCount(0);
    }
  });

  test("the start address just returns to the sign-in page with a notice", async ({ request, page }) => {
    const res = await request.get("/api/auth/google/start?role=provider", { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()["location"]).toMatch(/\/login\?role=provider&google=failed$/);
    expect(res.headers()["set-cookie"] ?? "").not.toContain("g_oauth");
    await page.goto("/login?role=provider&google=failed");
    await expect(page.locator("form").getByRole("alert")).toHaveText("Google orqali kirib boʻlmadi. Qayta urinib koʻring.");
  });
});

test.describe("with the Google keys", () => {
  test.skip(!KEYS, "needs the server started with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (and E2E_GOOGLE_KEYS=1)");

  test("the button is on both sign-in doors and both sign-up pages, and follows the door", async ({ page }) => {
    await page.goto("/login?role=client");
    await expect(page.getByRole("link", { name: BUTTON })).toHaveAttribute("href", "/api/auth/google/start?role=client");
    await page.goto("/login?role=provider");
    await expect(page.getByRole("link", { name: BUTTON })).toHaveAttribute("href", "/api/auth/google/start?role=provider");
    await page.goto("/login?role=client&next=%2Fsearch");
    await expect(page.getByRole("link", { name: BUTTON })).toHaveAttribute("href", "/api/auth/google/start?role=client&next=%2Fsearch");
  });

  test("on the sign-up page the account type chosen decides what Google makes", async ({ page }) => {
    await page.goto("/register?role=client");
    const button = page.getByRole("link", { name: BUTTON });
    await expect(button).toHaveAttribute("href", "/api/auth/google/start?role=client");
    await page.getByRole("radio", { name: /Ijodkorman/ }).click();
    await expect(button).toHaveAttribute("href", "/api/auth/google/start?role=provider");
    await page.getByRole("radio", { name: /Buyurtma bermoqchiman/ }).click();
    await expect(button).toHaveAttribute("href", "/api/auth/google/start?role=client");
  });

  test("the admin door has no Google button, and its start address refuses", async ({ page, request }) => {
    await page.goto("/login?role=admin");
    await expect(page.getByRole("button", { name: "Kirish" })).toBeVisible();
    await expect(page.getByRole("link", { name: BUTTON })).toHaveCount(0);
    const res = await request.get("/api/auth/google/start?role=admin", { maxRedirects: 0 });
    expect(res.headers()["location"]).toMatch(/\/login\?role=admin&google=admin$/);
  });

  test("the start address sends the person to Google's account chooser, and seals the flow in a safe cookie", async ({ request }) => {
    const res = await request.get("/api/auth/google/start?role=provider&next=%2Forders%2F9", { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    const to = new URL(res.headers()["location"]);
    expect(to.origin + to.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(to.searchParams.get("prompt")).toBe("select_account"); // they choose their own Google account, every time
    expect(to.searchParams.get("code_challenge_method")).toBe("S256");
    expect(to.searchParams.get("redirect_uri")).toMatch(/\/api\/auth\/google\/callback$/);
    const cookie = res.headers()["set-cookie"];
    expect(cookie).toContain("g_oauth=");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth\/google/);
  });
});

test.describe("when Google sends the person back", () => {
  test("a return with no flow cookie signs nobody in", async ({ request, page }) => {
    const res = await request.get("/api/auth/google/callback?code=made-up&state=made-up", { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()["location"]).toMatch(/\/login\?role=client&google=failed$/);
    expect(res.headers()["set-cookie"] ?? "").not.toMatch(/(^|\n|, )session=/);
    expect((await page.context().cookies()).map((c) => c.name)).not.toContain("session");
  });

  test("Cancel is a quiet notice, not an error", async ({ page }) => {
    await page.goto("/login?role=client&google=cancelled");
    const notice = page.locator("form").getByRole("status");
    await expect(notice).toHaveText("Google orqali kirish bekor qilindi.");
    await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
  });

  test("an email Google has not verified is explained", async ({ page }) => {
    await page.goto("/login?role=provider&google=unverified");
    await expect(page.locator("form").getByRole("alert")).toContainText("Google hisobingizdagi email tasdiqlanmagan.");
  });

  test("an account of the other kind is sent to its own door", async ({ page }) => {
    await page.goto("/login?role=client&google=wrong_door&door=provider");
    const alert = page.locator("form").getByRole("alert");
    await expect(alert).toContainText("Bu ijodkor hisobi. Ijodkorlar eshigidan kiring.");
    await alert.getByRole("link", { name: "Ijodkor sifatida kirish" }).click();
    await expect(page).toHaveURL(/\/login\?role=provider/);
  });

  test("an admin account is told to use its password", async ({ page }) => {
    await page.goto("/login?role=client&google=admin");
    await expect(page.locator("form").getByRole("alert")).toHaveText("Admin hisobi Google orqali kirmaydi. Email va parol bilan kiring.");
  });

  test("an unknown reason shows nothing", async ({ page }) => {
    await page.goto("/login?role=client&google=<script>alert(1)</script>");
    await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
    await expect(page.locator("form").getByRole("status")).toHaveCount(0);
  });
});
