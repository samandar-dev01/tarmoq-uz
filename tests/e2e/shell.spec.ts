import { test as base, expect, type Page } from "@playwright/test";
import { BASE, login, settled } from "./helpers";

/**
 * The app shell: the account menu in the header and the footer that fits who is looking.
 * Seeded accounts only. A fresh forwarded address per test keeps the tests apart where the rate limiter is on (a
 * forwarder in front of a production build overrides this header, which is fine too).
 */

const CLIENT = { email: "client@demo.test", name: "Demo Mijoz", role: "Mijoz", home: "/dashboard/client" };
const CREATOR = { email: "jasur@demo.test", name: "Jasur Karimov", role: "Ijodkor", home: "/dashboard/provider" };
const ADMIN = { email: "admin@demo.test", name: "Demo Admin", role: "Admin", home: "/admin" };
const ALL = [CLIENT, CREATOR, ADMIN];

const byte = () => Math.floor(Math.random() * 254) + 1;
const test = base.extend<{ address: string }>({
  address: async ({}, use) => use(`10.${byte()}.${byte()}.${byte()}`),
  extraHTTPHeaders: async ({ address }, use) => use({ "x-forwarded-for": address }),
});

const header = (page: Page) => page.locator("header");
const trigger = (page: Page) => header(page).getByRole("button", { name: /^Hisob menyusi/ });
const panel = (page: Page) => page.getByRole("menu");
const item = (page: Page, name: string) => panel(page).getByRole("menuitem", { name, exact: true });
const itemNames = async (page: Page) => (await panel(page).getByRole("menuitem").allInnerTexts()).map((t) => t.trim());
const themeToggle = (page: Page) => header(page).getByRole("button", { name: /rejimga oʻtish$/ });
const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

async function setTheme(page: Page, theme: "dark" | "light") {
  await page.context().addCookies([{ name: "theme", value: theme, url: BASE }]);
  await page.reload();
  await settled(page);
}

/** Waits until the panel has finished its short fade-in (measured mid-fade, it is a few pixels off). */
async function panelSettled(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => (a.effect as KeyframeEffect | null)?.target?.querySelector?.('[role="menu"]'))
      .every((a) => a.playState === "finished"),
  );
}

/** Opens the menu with the mouse and waits until it is up and still. */
async function openMenu(page: Page) {
  await trigger(page).click();
  await expect(panel(page)).toBeVisible();
  await panelSettled(page);
}

// Colour maths for the contrast checks, on what the browser actually paints.
const CONTRAST_JS = `(() => {
  const parse = (s) => {
    let m = /^rgba?\\(([^)]+)\\)$/.exec(s);
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
    m = /^color\\(srgb ([^)]+)\\)$/.exec(s);
    if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; }
    return [0, 0, 0, 0];
  };
  const over = (top, under) => { const a = top[3]; return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1]; };
  const lum = ([r, g, b]) => { const f = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  // What is really behind an element: its own fill over its parents' fills, up to the page.
  const behind = (el) => {
    const stack = [];
    for (let e = el; e; e = e.parentElement) stack.push(parse(getComputedStyle(e).backgroundColor));
    let out = parse(getComputedStyle(document.body).backgroundColor);
    if (out[3] === 0) out = [255, 255, 255, 1];
    for (const fill of stack.reverse()) out = over(fill, out);
    return out;
  };
  window.__contrast = (el) => ratio(over(parse(getComputedStyle(el).color), behind(el)), behind(el));
  window.__ringContrast = (el) => { const s = getComputedStyle(el); return { style: s.outlineStyle, width: s.outlineWidth, ratio: ratio(parse(s.outlineColor), behind(el)) }; };
})()`;
const contrastOf = async (page: Page, locator: ReturnType<Page["locator"]>) => {
  await page.evaluate(CONTRAST_JS);
  return locator.evaluate((el) => (window as unknown as { __contrast: (e: Element) => number }).__contrast(el));
};

test.describe("the account menu in the header", () => {
  for (const who of ALL) {
    test(`${who.role}: the header has one account menu named after the person, and no loose Chiqish`, async ({ page }) => {
      await login(page, who.email);
      await page.goto("/");
      await settled(page);
      await expect(trigger(page)).toBeVisible();
      await expect(trigger(page)).toHaveAttribute("aria-label", `Hisob menyusi: ${who.name}`);
      await expect(trigger(page)).toHaveAttribute("aria-haspopup", "menu");
      await expect(trigger(page)).toHaveAttribute("aria-expanded", "false");
      await expect(header(page).getByRole("button", { name: /^Hisob menyusi/ })).toHaveCount(1);
      // Nothing to sign out with in the header or the footer until the menu is open...
      await expect(page.getByRole("link", { name: "Chiqish" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Chiqish" })).toHaveCount(0);
      // ...and then it is a menu item, in the menu only.
      await openMenu(page);
      await expect(item(page, "Chiqish")).toHaveCount(1);
      await expect(page.getByRole("link", { name: "Chiqish" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Chiqish" })).toHaveCount(0);
    });
  }

  test("the button is a 44 px target that shows the person's initials, and sits right of the colour-scheme button", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    const t = (await trigger(page).boundingBox())!;
    expect(t.width).toBeGreaterThanOrEqual(44);
    expect(t.height).toBeGreaterThanOrEqual(44);
    await expect(trigger(page)).toHaveText("DM"); // Demo Mijoz
    const s = (await themeToggle(page).boundingBox())!;
    expect(s.x + s.width).toBeLessThanOrEqual(t.x);
    expect(Math.abs(s.y + s.height / 2 - (t.y + t.height / 2))).toBeLessThanOrEqual(2);
    // The wide-screen links come before both.
    const nav = (await header(page).getByRole("navigation", { name: "Asosiy menyu" }).boundingBox())!;
    expect(nav.x + nav.width).toBeLessThanOrEqual(s.x);
  });

  test("the panel begins with who is signed in (not an item), then the destinations, a divider and Chiqish", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    await openMenu(page);
    const id = await trigger(page).getAttribute("aria-controls");
    const box = page.locator(`[id="${id}"]`);
    await expect(box).toContainText("Demo Mijoz");
    await expect(box).toContainText("Mijoz");
    await expect(panel(page)).toHaveAttribute("aria-labelledby", /.+/);
    // The note is outside the list of items: the list has only items and the divider.
    expect(await panel(page).evaluate((el) => [...el.children].map((c) => c.getAttribute("role")))).toEqual(["menuitem", "menuitem", "menuitem", "menuitem", "separator", "menuitem"]); // three destinations, Yordam, divider, Chiqish
    await expect(panel(page).getByText("Demo Mijoz")).toHaveCount(0);
    // No settings item yet: the page for it is a later wave.
    await expect(page.getByRole("menuitem", { name: "Sozlamalar" })).toHaveCount(0);
  });
});

test.describe("what each role finds in the menu", () => {
  test("a client has Kabinet, Xabarlar and Ijodkorlar, then Chiqish", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    await openMenu(page);
    expect(await itemNames(page)).toEqual(["Kabinet", "Xabarlar", "Ijodkorlar", "Yordam", "Chiqish"]);
    await expect(item(page, "Kabinet")).toHaveAttribute("href", CLIENT.home);
    await expect(item(page, "Xabarlar")).toHaveAttribute("href", "/messages");
    await expect(item(page, "Ijodkorlar")).toHaveAttribute("href", "/search");
    // On a wide screen the creator list and messages are also plain header links, and the cabinet is not.
    const plain = header(page).getByRole("navigation", { name: "Asosiy menyu" }).getByRole("link");
    expect((await plain.allInnerTexts()).map((t) => t.trim())).toEqual(["Ijodkorlar", "Xabarlar"]);
  });

  test("a creator has Kabinet and Xabarlar and never Ijodkorlar", async ({ page }) => {
    await login(page, CREATOR.email);
    await page.goto("/");
    await settled(page);
    await openMenu(page);
    expect(await itemNames(page)).toEqual(["Kabinet", "Xabarlar", "Yordam", "Chiqish"]);
    await expect(item(page, "Kabinet")).toHaveAttribute("href", CREATOR.home);
    await expect(page.getByRole("menuitem", { name: "Ijodkorlar" })).toHaveCount(0);
    await expect(page.locator('header a[href="/search"]')).toHaveCount(0);
    const plain = header(page).getByRole("navigation", { name: "Asosiy menyu" }).getByRole("link");
    expect((await plain.allInnerTexts()).map((t) => t.trim())).toEqual(["Xabarlar"]);
  });

  test("an admin has Admin and no Xabarlar", async ({ page }) => {
    await login(page, ADMIN.email);
    await page.goto("/admin");
    await settled(page);
    await openMenu(page);
    expect(await itemNames(page)).toEqual(["Admin", "Ijodkorlar", "Chiqish"]);
    await expect(item(page, "Admin")).toHaveAttribute("href", "/admin");
    await expect(page.getByRole("menuitem", { name: "Xabarlar" })).toHaveCount(0);
    await expect(page.locator('header a[href="/messages"]')).toHaveCount(0);
    // The page you are on is marked, the way the nav links mark it.
    await expect(item(page, "Admin")).toHaveAttribute("aria-current", "page");
    await expect(item(page, "Ijodkorlar")).not.toHaveAttribute("aria-current", /.*/);
  });

  test("a visitor has no account menu: the sign-in buttons and Menyu are as before", async ({ page }) => {
    await page.goto("/");
    await settled(page);
    await expect(trigger(page)).toHaveCount(0);
    await expect(header(page).getByRole("link", { name: "Mijoz sifatida kirish" })).toBeVisible();
    await expect(header(page).getByRole("link", { name: "Ijodkor sifatida kirish" })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(header(page).locator("summary", { hasText: "Menyu" })).toBeVisible();
  });
});

test.describe("opening and closing", () => {
  test("a click opens it, a second click closes it, and the first item has the focus", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    await expect(panel(page)).toHaveCount(0);
    await trigger(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(trigger(page)).toHaveAttribute("aria-expanded", "true");
    await expect(trigger(page)).toHaveAttribute("aria-controls", /.+/);
    await expect(item(page, "Kabinet")).toBeFocused();
    await trigger(page).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(trigger(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("a click outside closes it, on the page and on another button", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    await openMenu(page);
    await page.mouse.click(3, 400);
    await expect(panel(page)).toHaveCount(0);
    await openMenu(page);
    await themeToggle(page).click(); // another control: it works, and the menu is gone
    await expect(panel(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
  });

  test("choosing an item closes the menu and goes there", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    await openMenu(page);
    await item(page, "Xabarlar").click();
    await expect(page).toHaveURL(/\/messages$/);
    await expect(panel(page)).toHaveCount(0);
    await settled(page);
    await openMenu(page);
    await expect(item(page, "Xabarlar")).toHaveAttribute("aria-current", "page");
  });

  test("Enter, Space and ArrowDown open it on the first item; ArrowUp opens it on the last", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    for (const key of ["Enter", "Space", "ArrowDown"]) {
      await trigger(page).focus();
      await page.keyboard.press(key);
      await expect(panel(page), key).toBeVisible();
      await expect(item(page, "Kabinet"), key).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(panel(page), key).toHaveCount(0);
    }
    await trigger(page).focus();
    await page.keyboard.press("ArrowUp");
    await expect(panel(page)).toBeVisible();
    await expect(item(page, "Chiqish")).toBeFocused();
  });

  test("ArrowDown, ArrowUp, Home and End move the focus (and wrap); Esc closes it and the focus goes back to the button", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    await trigger(page).focus();
    await page.keyboard.press("Enter");
    await expect(item(page, "Kabinet")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(item(page, "Xabarlar")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(item(page, "Ijodkorlar")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(item(page, "Yordam")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(item(page, "Chiqish")).toBeFocused();
    await page.keyboard.press("ArrowDown"); // wraps
    await expect(item(page, "Kabinet")).toBeFocused();
    await page.keyboard.press("ArrowUp"); // wraps back
    await expect(item(page, "Chiqish")).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(item(page, "Yordam")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(item(page, "Kabinet")).toBeFocused();
    await page.keyboard.press("End");
    await expect(item(page, "Chiqish")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
    await expect(trigger(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("Esc closes it while the focus is on the button, and Tab closes it and moves on", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    await trigger(page).click();
    await trigger(page).focus();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);

    await trigger(page).focus();
    await page.keyboard.press("Enter");
    await expect(item(page, "Kabinet")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(panel(page)).toHaveCount(0);
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="menu"]'))).toBe(false);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false); // it went on to the next control
  });

  test("Enter on an item follows its link; Space does the same", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    await trigger(page).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown"); // Xabarlar
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/messages$/);
    await settled(page);
    await trigger(page).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Home"); // Kabinet
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(new RegExp(`${CLIENT.home}$`));
    await expect(panel(page)).toHaveCount(0);
  });

  test("opening it moves nothing: the header keeps its size and the page does not grow", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    const before = { header: await header(page).boundingBox(), toggle: await themeToggle(page).boundingBox(), trigger: await trigger(page).boundingBox(), height: await page.evaluate(() => document.documentElement.scrollHeight) };
    await openMenu(page);
    expect(await header(page).boundingBox()).toEqual(before.header);
    expect(await themeToggle(page).boundingBox()).toEqual(before.toggle);
    expect(await trigger(page).boundingBox()).toEqual(before.trigger);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(before.height);
  });

  test("the panel floats above the page: pointing at any item reaches the item, not the page behind", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    await openMenu(page);
    const covered = await panel(page).getByRole("menuitem").evaluateAll((els) =>
      els.filter((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return !hit || !el.contains(hit);
      }).length,
    );
    expect(covered).toBe(0);
  });

  test("every item is at least 44 px high, and the panel hangs under the button, right edge to right edge", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    await openMenu(page);
    for (const box of await panel(page).getByRole("menuitem").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
    const t = (await trigger(page).boundingBox())!;
    const id = await trigger(page).getAttribute("aria-controls");
    const p = (await page.locator(`[id="${id}"]`).boundingBox())!;
    expect(p.y).toBeGreaterThanOrEqual(t.y + t.height);
    expect(Math.abs(p.x + p.width - (t.x + t.width))).toBeLessThanOrEqual(1);
  });

  test("it fades in, and under reduced motion it does not animate", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    const animation = async () => {
      const id = await trigger(page).getAttribute("aria-controls");
      return page.locator(`[id="${id}"]`).evaluate((el) => getComputedStyle(el).animationName);
    };
    await openMenu(page);
    expect(await animation()).toBe("menu-in");
    await page.keyboard.press("Escape");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openMenu(page);
    expect(await animation()).toBe("none");
  });
});

test.describe("signing out", () => {
  test("Chiqish signs out and lands on the signed-out home", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    await openMenu(page);
    await item(page, "Chiqish").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(header(page).getByRole("link", { name: "Mijoz sifatida kirish" })).toBeVisible();
    await expect(trigger(page)).toHaveCount(0);
    const names = (await page.context().cookies()).map((c) => c.name);
    expect(names).not.toContain("session");
    // A signed-out page of a signed-in area sends the visitor to the door again.
    await page.goto("/dashboard/client");
    await expect(page).toHaveURL(/\/login/);
  });

  test("while the request is out it says Chiqilmoqda… and ignores a second press; the menu stays up", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let calls = 0;
    await page.route("**/api/auth/logout", async (route) => {
      calls += 1;
      await gate;
      await route.continue();
    });
    await openMenu(page);
    await item(page, "Chiqish").click();
    const busy = item(page, "Chiqilmoqda…");
    await expect(busy).toBeVisible();
    await expect(busy).toHaveAttribute("aria-disabled", "true");
    await expect(panel(page)).toBeVisible();
    await busy.click({ force: true }); // Playwright treats aria-disabled as not enabled, so a plain click would wait for ever
    expect(calls).toBe(1);
    release();
    await expect(page).toHaveURL(/\/$/);
    await expect(trigger(page)).toHaveCount(0);
  });

  test("when the request fails the person stays signed in and can try again", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    await page.route("**/api/auth/logout", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
    await openMenu(page);
    await item(page, "Chiqish").click();
    await expect(item(page, "Chiqish")).toBeVisible(); // back from Chiqilmoqda…
    await expect(item(page, "Chiqish")).not.toHaveAttribute("aria-disabled", "true");
    await expect(trigger(page)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await page.unroute("**/api/auth/logout");
    await item(page, "Chiqish").click();
    await expect(trigger(page)).toHaveCount(0);
    await expect(header(page).getByRole("link", { name: "Mijoz sifatida kirish" })).toBeVisible();
  });
});

test.describe("the footer fits who is looking", () => {
  const footerLinks = async (page: Page) => {
    const links = page.getByRole("navigation", { name: "Pastki menyu" }).getByRole("link");
    return (await links.allInnerTexts()).map((t) => t.trim());
  };
  const footerHrefs = (page: Page) => page.getByRole("navigation", { name: "Pastki menyu" }).getByRole("link").evaluateAll((els) => els.map((el) => el.getAttribute("href")));

  // Everyone but an admin ends with Yordam, the support team's Telegram (an outside address, so no site prefix).
  const HELP_HREF = "https://t.me/justuzbe";

  test("a visitor keeps the three links of before, then Yordam", async ({ page }) => {
    await page.goto("/");
    expect(await footerLinks(page)).toEqual(["Ijodkorlar", "Ijodkor boʻlib qoʻshilish", "Buyurtma bermoqchiman", "Yordam"]);
    expect(await footerHrefs(page)).toEqual(["/search", "/register?role=provider", "/register?role=client", HELP_HREF]);
  });

  test("a client has Ijodkorlar, Kabinet and Xabarlar, then Yordam", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    expect(await footerLinks(page)).toEqual(["Ijodkorlar", "Kabinet", "Xabarlar", "Yordam"]);
    expect(await footerHrefs(page)).toEqual(["/search", CLIENT.home, "/messages", HELP_HREF]);
  });

  test("a creator has Kabinet and Xabarlar, then Yordam, never Ijodkorlar", async ({ page }) => {
    await login(page, CREATOR.email);
    await page.goto("/");
    expect(await footerLinks(page)).toEqual(["Kabinet", "Xabarlar", "Yordam"]);
    expect(await footerHrefs(page)).toEqual([CREATOR.home, "/messages", HELP_HREF]);
  });

  test("an admin has Admin only", async ({ page }) => {
    await login(page, ADMIN.email);
    await page.goto("/");
    expect(await footerLinks(page)).toEqual(["Admin"]);
    expect(await footerHrefs(page)).toEqual(["/admin"]);
  });

  test("nobody who is signed in is asked to sign up, and the rest of the footer is as it was", async ({ page }) => {
    for (const who of ALL) {
      await login(page, who.email);
      await page.goto("/");
      await expect(page.locator('footer a[href^="/register"]')).toHaveCount(0);
      await expect(page.locator("footer")).toContainText("Oʻzbekiston ijodkorlari bir tarmoqda: videograf, fotograf va montajchilarni toping.");
      await expect(page.locator("footer")).toContainText(`© ${new Date().getFullYear()} Tarmoq.uz.`);
      await openMenu(page);
      await item(page, "Chiqish").click();
      await expect(trigger(page)).toHaveCount(0);
    }
  });
});

test.describe("on a phone, in both colour schemes", () => {
  test.use({ hasTouch: true });

  for (const [width, height] of [[390, 844], [320, 640]] as const) {
    for (const who of ALL) {
      test(`${who.role} at ${width} px: the header does not scroll sideways and the panel stays on the screen, dark and light`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await login(page, who.email);
        await page.goto("/");
        await settled(page);
        for (const theme of ["dark", "light"] as const) {
          await setTheme(page, theme);
          expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
          // Closed: nothing sticks out, the buttons are targets, the account menu replaces Menyu.
          expect(await scrollWidth(page), `${theme} closed`).toBeLessThanOrEqual(width);
          await expect(header(page).locator("summary", { hasText: "Menyu" })).toHaveCount(0);
          const t = (await trigger(page).boundingBox())!;
          const s = (await themeToggle(page).boundingBox())!;
          expect(t.width).toBeGreaterThanOrEqual(44);
          expect(t.height).toBeGreaterThanOrEqual(44);
          expect(t.x + t.width, `${theme} trigger`).toBeLessThanOrEqual(width);
          expect(s.x + s.width).toBeLessThanOrEqual(t.x); // the scheme button is left of the account menu, not on top of it
          expect(s.x).toBeGreaterThanOrEqual(0);
          // Open (with a tap): inside the screen, and still no sideways scroll.
          await trigger(page).tap();
          await expect(panel(page)).toBeVisible();
          await panelSettled(page);
          const id = await trigger(page).getAttribute("aria-controls");
          const p = (await page.locator(`[id="${id}"]`).boundingBox())!;
          expect(p.x, `${theme} panel left`).toBeGreaterThanOrEqual(0);
          expect(p.x + p.width, `${theme} panel right`).toBeLessThanOrEqual(width);
          expect(p.width, `${theme} panel width`).toBeLessThanOrEqual(width - 16);
          expect(await scrollWidth(page), `${theme} open`).toBeLessThanOrEqual(width);
          for (const h of await panel(page).getByRole("menuitem").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44);
          await page.keyboard.press("Escape");
        }
      });
    }
  }

  test("a very long name wraps inside the panel and the header does not overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const name = "Muhammadsodiqovichabdurahmonovichqodirovichxudoyberdiyevichsaidakbar";
    const res = await page.request.post("/api/auth/register", { data: { name, email: `e2e-shell-${Date.now()}-${byte()}@example.test`, password: "Passw0rd!x", role: "CLIENT" } });
    expect(res.ok()).toBeTruthy();
    await page.goto("/");
    await settled(page);
    expect(await scrollWidth(page)).toBeLessThanOrEqual(390);
    await openMenu(page);
    const id = await trigger(page).getAttribute("aria-controls");
    const p = (await page.locator(`[id="${id}"]`).boundingBox())!;
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x + p.width).toBeLessThanOrEqual(390);
    expect(await scrollWidth(page)).toBeLessThanOrEqual(390);
    expect(await page.locator(`[id="${id}"]`).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true); // nothing spills out of the panel
  });
});

test.describe("readable and visible in both colour schemes", () => {
  test("item text, the name and the role reach 4.5:1 (idle, pointed at and current), and the keyboard ring is a visible 2 px ring", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto(CLIENT.home); // here Kabinet is the current page
    await settled(page);
    for (const theme of ["dark", "light"] as const) {
      await setTheme(page, theme);
      await trigger(page).focus();
      await page.keyboard.press("Enter"); // by keyboard, so the ring shows
      await expect(panel(page)).toBeVisible();
      await panelSettled(page);
      await expect(item(page, "Kabinet")).toBeFocused();
      await expect(item(page, "Kabinet")).toHaveAttribute("aria-current", "page");

      for (const name of ["Kabinet", "Xabarlar", "Ijodkorlar", "Chiqish"]) {
        expect(await contrastOf(page, item(page, name)), `${theme}: ${name}`).toBeGreaterThanOrEqual(4.5);
      }
      const id = await trigger(page).getAttribute("aria-controls");
      const box = page.locator(`[id="${id}"]`);
      expect(await contrastOf(page, box.getByText("Demo Mijoz", { exact: true })), `${theme}: name`).toBeGreaterThanOrEqual(4.5);
      expect(await contrastOf(page, box.getByText("Mijoz", { exact: true })), `${theme}: role`).toBeGreaterThanOrEqual(4.5);

      // Pointed at (the hover fill is a tint of the text colour, so check it after the 150 ms colour change settles).
      await item(page, "Ijodkorlar").hover();
      await expect.poll(() => contrastOf(page, item(page, "Ijodkorlar")), { message: `${theme}: pointed-at item` }).toBeGreaterThanOrEqual(4.5);

      // The ring: the project's 2 px focus ring, readable against the panel (3:1 for a part without words).
      await page.keyboard.press("Home");
      await expect(item(page, "Kabinet")).toBeFocused();
      await page.evaluate(CONTRAST_JS);
      const ring = await item(page, "Kabinet").evaluate((el) => (window as unknown as { __ringContrast: (e: Element) => { style: string; width: string; ratio: number } }).__ringContrast(el));
      expect(ring.style, theme).toBe("solid");
      expect(ring.width, theme).toBe("2px");
      expect(ring.ratio, `${theme}: ring`).toBeGreaterThanOrEqual(3);

      // The panel itself stands off the page: a visible edge.
      expect(await box.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("1px");
      await page.keyboard.press("Escape");
    }
  });

  test("the panel and the button are painted from the theme: they differ between dark and light", async ({ page }) => {
    await login(page, CLIENT.email);
    await page.goto("/");
    await settled(page);
    const paint = async () => {
      await openMenu(page);
      const id = await trigger(page).getAttribute("aria-controls");
      const out = await page.locator(`[id="${id}"]`).evaluate((el) => ({ fill: getComputedStyle(el).backgroundColor, text: getComputedStyle(el.querySelector('[role="menuitem"]')!).color }));
      await page.keyboard.press("Escape");
      return out;
    };
    await setTheme(page, "dark");
    const dark = await paint();
    await setTheme(page, "light");
    const light = await paint();
    expect(dark.fill).not.toBe(light.fill);
    expect(dark.text).not.toBe(light.text);
  });
});
