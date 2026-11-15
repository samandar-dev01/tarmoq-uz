import { test as base, expect, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";
import { PASSWORD, settled, type Door } from "./helpers";

/**
 * Sign-in doors: /login?role=client|provider|admin. A creator at the client door, a client at the creator door and
 * anyone at the admin door (unless they are the admin) get an error AFTER the password was right, with no session.
 * A wrong password at any door says what it always said.
 */

const CREATOR = "jasur@demo.test";
const CLIENT = "client@demo.test";
const ADMIN = "admin@demo.test";

const BAD_LOGIN = "Email yoki parol notoʻgʻri.";
const IS_CREATOR = "Bu ijodkor hisobi. Ijodkorlar eshigidan kiring.";
const IS_CLIENT = "Bu mijoz hisobi. Mijozlar eshigidan kiring.";
const IS_ADMIN = "Bu hisob uchun boshqa kirish sahifasi bor.";

// Wrong passwords count as failures. A fresh address for every test keeps the tests, and repeated runs, apart where
// the limiter is on (it is off in dev); a forwarder in front of a production build overrides this header, which is fine too.
const byte = () => Math.floor(Math.random() * 254) + 1;
const test = base.extend<{ address: string }>({
  address: async ({}, use) => use(`10.${byte()}.${byte()}.${byte()}`),
  extraHTTPHeaders: async ({ address }, use) => use({ "x-forwarded-for": address }),
});

const cookieNames = async (page: Page) => (await page.context().cookies()).map((c) => c.name);
const cookieValue = async (page: Page, name: string) => (await page.context().cookies()).find((c) => c.name === name)?.value;

/** The error box of the sign-in form (the page has no other `alert` inside the form). */
const formAlert = (page: Page) => page.locator("form").getByRole("alert");

async function fillAndSubmit(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parol").fill(password);
  await page.getByRole("button", { name: "Kirish" }).click();
}

async function openDoor(page: Page, door: Door, next?: string) {
  await page.goto(`/login?role=${door}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  await settled(page);
}

const post = (request: APIRequestContext, email: string, password: string, role?: Door) =>
  request.post("/api/auth/login", { data: { email, password, ...(role ? { role } : {}) } });

/** The response set no cookie at all: not the session, not the remembered door. */
const setsNoCookie = (res: APIResponse) => expect(res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie")).toHaveLength(0);

test.describe("a creator at the client door", () => {
  test("is refused with a link to the creator door, and gets no session (UI)", async ({ page }) => {
    await openDoor(page, "client", "/messages");
    await fillAndSubmit(page, CREATOR);

    await expect(formAlert(page)).toContainText(IS_CREATOR);
    await expect(formAlert(page).getByRole("link", { name: "Ijodkor sifatida kirish" })).toBeVisible();
    await expect(page).toHaveURL(/\/login\?role=client/); // not sent anywhere, and no "you signed in as a creator" toast
    await expect(page.getByLabel("Email")).toHaveValue(CREATOR);
    await expect(page.getByLabel("Parol")).toHaveValue(""); // the password is cleared, the email stays
    expect(await cookieNames(page)).not.toContain("session");
    expect(await cookieNames(page)).not.toContain("last_role");

    // Still signed out: the creator's cabinet sends them to the creator door.
    await page.goto("/dashboard/provider");
    await expect(page).toHaveURL(/\/login\?role=provider/);
  });

  test("is refused with a 403 WRONG_DOOR and no cookie (API)", async ({ request }) => {
    const res = await post(request, CREATOR, PASSWORD, "client");
    expect(res.status()).toBe(403);
    expect(await res.json()).toEqual({ error: IS_CREATOR, details: { code: "WRONG_DOOR", door: "provider" } });
    setsNoCookie(res);
    // The same account at its own door, and with no door named (API clients), still signs in.
    for (const role of ["provider", undefined] as const) {
      const ok = await post(request, CREATOR, PASSWORD, role);
      expect(ok.status()).toBe(200);
      expect((await ok.json()).user.role).toBe("PROVIDER");
    }
  });
});

test.describe("a client at the creator door", () => {
  test("is refused with a link to the client door, and gets no session (UI)", async ({ page }) => {
    await openDoor(page, "provider");
    await fillAndSubmit(page, CLIENT);

    await expect(formAlert(page)).toContainText(IS_CLIENT);
    await expect(formAlert(page).getByRole("link", { name: "Mijoz sifatida kirish" })).toBeVisible();
    await expect(page).toHaveURL(/\/login\?role=provider/);
    await expect(page.getByLabel("Email")).toHaveValue(CLIENT);
    await expect(page.getByLabel("Parol")).toHaveValue("");
    expect(await cookieNames(page)).not.toContain("session");

    await page.goto("/dashboard/client");
    await expect(page).toHaveURL(/\/login\?role=client/);
  });

  test("is refused with a 403 WRONG_DOOR and no cookie (API)", async ({ request }) => {
    const res = await post(request, CLIENT, PASSWORD, "provider");
    expect(res.status()).toBe(403);
    expect(await res.json()).toEqual({ error: IS_CLIENT, details: { code: "WRONG_DOOR", door: "client" } });
    setsNoCookie(res);
    expect((await post(request, CLIENT, PASSWORD, "client")).status()).toBe(200);
  });
});

test("the link in the error opens the right door with next and the email kept, and sign-in lands on next", async ({ page }) => {
  // /messages is open to a creator as well as a client.
  await openDoor(page, "client", "/messages");
  await fillAndSubmit(page, CREATOR);
  await formAlert(page).getByRole("link", { name: "Ijodkor sifatida kirish" }).click();

  await expect(page).toHaveURL(/role=provider/);
  const url = new URL(page.url());
  expect(url.pathname).toBe("/login");
  expect(url.searchParams.get("role")).toBe("provider");
  expect(url.searchParams.get("next")).toBe("/messages");
  expect(url.search).not.toContain("jasur"); // the email never travels in the address
  expect(url.search).not.toContain(PASSWORD);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ijodkor sifatida kirish");
  await expect(formAlert(page)).toHaveCount(0); // the error belonged to the other door
  await expect(page.getByLabel("Email")).toHaveValue(CREATOR); // the same form stays mounted: what was typed survives
  await expect(page.getByLabel("Parol")).toHaveValue("");

  await page.getByLabel("Parol").fill(PASSWORD);
  await page.getByRole("button", { name: "Kirish" }).click();
  await expect(page).toHaveURL(/\/messages$/);
  expect(await cookieNames(page)).toContain("session");
  expect(await cookieValue(page, "last_role")).toBe("provider");
});

test("a next that leaves the site is not carried by the link in the error", async ({ page }) => {
  await openDoor(page, "client", "//evil.example/steal");
  await fillAndSubmit(page, CREATOR);
  const link = formAlert(page).getByRole("link", { name: "Ijodkor sifatida kirish" });
  await expect(link).toHaveAttribute("href", "/login?role=provider");
});

test("a wrong password at the wrong door reveals nothing about the account's role", async ({ page, request }) => {
  const wrong = "not-the-password-1";
  const answers = [
    await post(request, CREATOR, wrong, "provider"), // an account at its own door
    await post(request, CREATOR, wrong, "client"), // at the wrong door
    await post(request, CLIENT, wrong, "provider"), // the other way round
    await post(request, ADMIN, wrong, "client"),
    await post(request, "nobody-here@demo.test", wrong, "client"), // no such account
    await post(request, "nobody-here@demo.test", wrong, "provider"),
  ];
  for (const res of answers) {
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: BAD_LOGIN });
    setsNoCookie(res);
  }

  // The form says the same thing and offers no link to another door.
  await openDoor(page, "client");
  await fillAndSubmit(page, CREATOR, wrong);
  await expect(formAlert(page)).toHaveText(BAD_LOGIN);
  await expect(formAlert(page).getByRole("link")).toHaveCount(0);
  expect(await cookieNames(page)).not.toContain("session");
});

test.describe("the admin door", () => {
  test("has an Admin heading, no tabs and no sign-up link, and lets the admin in", async ({ page }) => {
    await openDoor(page, "admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Admin");
    await expect(page.getByRole("navigation", { name: "Hisob turi" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Roʻyxatdan oʻting" })).toHaveCount(0);

    await fillAndSubmit(page, ADMIN);
    await expect(page).toHaveURL(/\/admin$/);
    expect(await cookieValue(page, "last_role")).toBe("admin");
  });

  test("the public doors keep exactly two tabs", async ({ page }) => {
    for (const door of ["client", "provider"] as const) {
      await openDoor(page, door);
      const tabs = page.getByRole("navigation", { name: "Hisob turi" }).getByRole("link");
      await expect(tabs).toHaveText(["Mijoz", "Ijodkor"]);
    }
  });

  test("the admin at the client or creator door is refused, with a link to the admin door (UI)", async ({ page }) => {
    await openDoor(page, "client");
    await fillAndSubmit(page, ADMIN);
    await expect(formAlert(page)).toContainText(IS_ADMIN);
    expect(await cookieNames(page)).not.toContain("session");
    await formAlert(page).getByRole("link", { name: "Admin kirishi" }).click();

    await expect(page).toHaveURL(/role=admin/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Admin");
    await expect(page.getByLabel("Email")).toHaveValue(ADMIN);
    await expect(page.getByLabel("Parol")).toHaveValue("");
  });

  test("the answers for every door the admin may not use (API)", async ({ request }) => {
    for (const door of ["client", "provider"] as const) {
      const res = await post(request, ADMIN, PASSWORD, door);
      expect(res.status()).toBe(403);
      expect(await res.json()).toEqual({ error: IS_ADMIN, details: { code: "WRONG_DOOR", door: "admin" } });
      setsNoCookie(res);
    }
    // A client or a creator at the admin door is sent to their own door, not told about an admin.
    const asClient = await post(request, CLIENT, PASSWORD, "admin");
    expect(asClient.status()).toBe(403);
    expect(await asClient.json()).toEqual({ error: IS_CLIENT, details: { code: "WRONG_DOOR", door: "client" } });
    const asCreator = await post(request, CREATOR, PASSWORD, "admin");
    expect(asCreator.status()).toBe(403);
    expect(await asCreator.json()).toEqual({ error: IS_CREATOR, details: { code: "WRONG_DOOR", door: "provider" } });
    // The admin at the admin door, and with no door named, signs in.
    for (const role of ["admin", undefined] as const) expect((await post(request, ADMIN, PASSWORD, role)).status()).toBe(200);
  });

  test("an unknown door name is a validation error, the same for every email", async ({ request }) => {
    const known = await post(request, CREATOR, PASSWORD, "root" as Door);
    const unknown = await post(request, "nobody-here@demo.test", PASSWORD, "root" as Door);
    expect(known.status()).toBe(400);
    expect(unknown.status()).toBe(400);
    expect(await known.json()).toEqual(await unknown.json());
  });
});

test.describe("signed-out visitors of protected pages", () => {
  test("a page for one role names its door", async ({ page }) => {
    for (const [path, door] of [
      ["/admin", "admin"],
      ["/admin/orders", "admin"],
      ["/dashboard/provider", "provider"],
      ["/dashboard/client", "client"],
      ["/orders/new", "client"],
    ] as const) {
      await page.goto(path);
      await expect(page, `${path} should lead to the ${door} door`).toHaveURL(new RegExp(`/login\\?role=${door}$`));
    }
  });

  test("a page for several roles uses the door of the last sign-in, then the client door", async ({ page }) => {
    await page.goto("/messages");
    await expect(page).toHaveURL(/\/login\?role=client$/);

    await page.context().addCookies([{ name: "last_role", value: "provider", url: new URL(page.url()).origin }]);
    for (const path of ["/messages", "/orders/some-order-id"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?role=provider$/);
    }
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ijodkor sifatida kirish");

    // A cookie that is not a door is the client door.
    await page.context().addCookies([{ name: "last_role", value: "superuser", url: new URL(page.url()).origin }]);
    await page.goto("/messages");
    await expect(page).toHaveURL(/\/login\?role=client$/);
  });
});
