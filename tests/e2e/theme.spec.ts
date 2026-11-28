import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { BASE, login, settled } from "./helpers";

// The light theme and its one button. The server reads the `theme` cookie and writes data-theme on <html>, so the first
// byte of HTML is already in the right scheme; the toggle flips it in the browser and remembers it in the same cookie.

const TO_LIGHT = "Yorugʻ rejimga oʻtish"; // what the button says in the dark scheme (the sun)
const TO_DARK = "Qorongʻi rejimga oʻtish"; // and in the light scheme (the moon)
const SUN_PATH = "M12 8a4 4 0 1 0 0 8"; // the start of the sun's disc in src/components/ui/Icon.tsx
const MOON_PATH = "M20 14.2A8 8 0 0 1 9.8 4"; // the moon's crescent

const htmlTag = (html: string) => /<html\b[^>]*>/.exec(html)?.[0] ?? "";
const metaThemeColor = (html: string) => /<meta name="theme-color" content="([^"]+)"/.exec(html)?.[1];
/** The toggle as the server wrote it: its label and whether it draws the sun or the moon. */
const serverToggle = (html: string) => {
  const m = /<button type="button" aria-label="([^"]+)"[^>]*>(.*?)<\/button>/s.exec(html.slice(html.indexOf("<header")));
  return { label: m?.[1], sun: !!m?.[2]?.includes(SUN_PATH), moon: !!m?.[2]?.includes(MOON_PATH) };
};

const toggle = (page: Page) => page.getByRole("button", { name: /rejimga oʻtish$/ });
const themeOf = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const themeCookie = async (context: BrowserContext) => (await context.cookies(BASE)).find((c) => c.name === "theme");

/** Watches for anything the console or the page reports as an error or a warning (a hydration mismatch is one). */
function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

test.describe("first byte of HTML", () => {
  test("first visit is light: the server HTML already says data-theme=light, with the sun on the button", async ({ request }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(htmlTag(html)).toContain('data-theme="light"');
    expect(metaThemeColor(html)).toBe("#FFFFFF");
    expect(serverToggle(html)).toEqual({ label: TO_DARK, sun: false, moon: true });
  });

  test("an unknown or stray cookie value is light too", async ({ request }) => {
    for (const value of ["sepia", "LIGHT", "", "dark,light", "%3Cscript%3E", "1"]) {
      const html = await (await request.get("/search", { headers: { cookie: `theme=${value}` } })).text();
      expect(htmlTag(html), `theme=${value}`).toContain('data-theme="light"');
    }
  });

  test("with the dark cookie the raw HTML is dark from the first byte, with the moon and the matching browser bar colour", async ({ request }) => {
    for (const path of ["/", "/search", "/login?role=client"]) {
      const html = await (await request.get(path, { headers: { cookie: "theme=dark" } })).text();
      expect(htmlTag(html), path).toContain('data-theme="dark"');
      expect(metaThemeColor(html), path).toBe("#090D16");
      expect(serverToggle(html), path).toEqual({ label: TO_LIGHT, sun: true, moon: false });
    }
  });
});

test.describe("one click", () => {
  test("flips to dark with no navigation, writes the cookie, and a reload (and the raw HTML with that cookie) is dark", async ({ page, context, request }) => {
    await page.goto("/");
    await settled(page);
    expect(await themeOf(page)).toBe("light");
    expect(await themeCookie(context)).toBeUndefined(); // nothing is stored before the visitor chooses

    // A marker that a reload or a navigation would wipe out.
    await page.evaluate(() => {
      (window as unknown as { __stay: boolean }).__stay = true;
    });
    const url = page.url();

    await toggle(page).click();
    await expect.poll(() => themeOf(page)).toBe("dark");
    expect(page.url()).toBe(url);
    expect(await page.evaluate(() => (window as unknown as { __stay?: boolean }).__stay)).toBe(true);
    await expect(page.getByRole("button", { name: TO_LIGHT })).toBeVisible(); // the name followed the scheme

    const cookie = await themeCookie(context);
    expect(cookie?.value).toBe("dark");
    expect(cookie?.path).toBe("/");
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie?.httpOnly).toBe(false); // the toggle writes it in the browser
    const lifetimeDays = (cookie!.expires - Date.now() / 1000) / 86400;
    expect(lifetimeDays).toBeGreaterThan(360);
    expect(lifetimeDays).toBeLessThanOrEqual(366);

    // A reload keeps it. The server has the cookie, so it paints dark before any script runs.
    await page.reload();
    await settled(page);
    expect(await themeOf(page)).toBe("dark");
    await expect(page.getByRole("button", { name: TO_LIGHT })).toBeVisible();

    // The raw HTML fetched with the cookie the browser holds is dark from the first byte.
    const html = await (await request.get("/", { headers: { cookie: `theme=${cookie!.value}` } })).text();
    expect(htmlTag(html)).toContain('data-theme="dark"');

    // And back: one more click returns to light, with the cookie to match.
    await toggle(page).click();
    await expect.poll(() => themeOf(page)).toBe("light");
    expect((await themeCookie(context))?.value).toBe("light");
    await page.reload();
    await settled(page);
    expect(await themeOf(page)).toBe("light");
  });

  test("the browser sees dark before React has started: the page paints from the server HTML alone", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.addCookies([{ name: "theme", value: "dark", url: BASE }]);
    const page = await context.newPage();
    await page.goto("/");
    expect(await themeOf(page)).toBe("dark");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(9, 13, 22)"); // the dark paper, painted with no script at all
    await context.close();
  });
});

test.describe("the button", () => {
  test("is 44x44 or larger, reachable by keyboard, shows the focus ring, and its name changes", async ({ page }) => {
    await page.goto("/");
    await settled(page);
    const box = await toggle(page).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expect(toggle(page)).toHaveAttribute("type", "button");
    await expect(toggle(page)).toHaveAttribute("title", TO_DARK);
    await expect(toggle(page)).not.toHaveAttribute("aria-pressed");

    // Tab until the toggle has focus (the logo and the nav links come first).
    let reached = false;
    for (let i = 0; i < 20 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await toggle(page).evaluate((el) => el === document.activeElement);
    }
    expect(reached, "the toggle can be reached with Tab").toBe(true);
    const ring = await toggle(page).evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: s.outlineWidth };
    });
    expect(ring).toEqual({ style: "solid", width: "2px" }); // the project's focus ring

    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: TO_LIGHT })).toBeVisible();
    expect(await themeOf(page)).toBe("dark");
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: TO_DARK })).toBeVisible();
    expect(await themeOf(page)).toBe("light");
  });

  test("does not move the page when pressed", async ({ page }) => {
    await page.goto("/search");
    await settled(page);
    const before = await toggle(page).boundingBox();
    const headerBefore = await page.locator("header").boundingBox();
    const mainBefore = await page.locator("main").boundingBox();
    await toggle(page).click();
    await expect.poll(() => themeOf(page)).toBe("dark");
    const after = await toggle(page).boundingBox();
    const headerAfter = await page.locator("header").boundingBox();
    const mainAfter = await page.locator("main").boundingBox();
    // The button lifts 1 px while the pointer is on it (a deliberate hover effect with a 150 ms transition), so its top is
    // compared with a tolerance. What must never change is its size, its sideways position and the layout around it.
    expect(after!.width).toBe(before!.width);
    expect(after!.height).toBe(before!.height);
    expect(after!.x).toBe(before!.x);
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1.5);
    expect(headerAfter!.height).toBe(headerBefore!.height);
    expect(mainAfter!.y).toBe(mainBefore!.y);
  });
});

test.describe("readable text, measured in the page", () => {
  /** Contrast of the real computed colours: the text colour against the nearest opaque background behind it. */
  async function measure(page: Page) {
    return page.evaluate(() => {
      const parse = (css: string): [number, number, number, number] => {
        const m = /rgba?\(([^)]+)\)/.exec(css);
        if (!m) throw new Error(`cannot read colour ${css}`);
        const p = m[1]!.split(/[,\s/]+/).filter(Boolean).map(Number);
        return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
      };
      const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      const lum = (c: number[]) => 0.2126 * lin(c[0]!) + 0.7152 * lin(c[1]!) + 0.0722 * lin(c[2]!);
      const ratio = (a: number[], b: number[]) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
      const backgroundBehind = (el: Element): number[] => {
        for (let e: Element | null = el; e; e = e.parentElement) {
          const bg = parse(getComputedStyle(e).backgroundColor);
          if (bg[3] === 1) return bg;
        }
        return [255, 255, 255];
      };
      const of = (el: Element | null, label: string) => {
        if (!el) throw new Error(`no element for ${label}`);
        const fg = parse(getComputedStyle(el).color);
        const bgSelf = parse(getComputedStyle(el).backgroundColor);
        const bg = bgSelf[3] === 1 ? bgSelf : backgroundBehind(el);
        return { label, ratio: ratio(fg, bg) };
      };
      return [
        of(document.querySelector("h1"), "headline"),
        of(document.querySelector("main p"), "intro text"),
        of(document.querySelector("form button[type=submit]"), "primary button"),
        of(document.querySelector('header a[href^="/login?role=provider"]'), "header primary button"),
        of(document.querySelector('header a[href^="/login?role=client"]'), "header secondary button"),
        of(document.querySelector("footer p"), "footer text"),
      ];
    });
  }

  for (const theme of ["dark", "light"] as const) {
    test(`in ${theme} mode body text and the primary button reach contrast 4.5`, async ({ page, context }) => {
      await context.addCookies([{ name: "theme", value: theme, url: BASE }]);
      await page.goto("/");
      await settled(page);
      expect(await themeOf(page)).toBe(theme);
      const results = await measure(page);
      expect(results.length).toBeGreaterThan(5);
      for (const r of results) expect(r.ratio, `${theme}: ${r.label}`).toBeGreaterThanOrEqual(4.5);
    });
  }

  test("the light page really is light: dark ink on a pale ground", async ({ page, context }) => {
    await context.addCookies([{ name: "theme", value: "light", url: BASE }]);
    await page.goto("/");
    await settled(page);
    const colours = await page.evaluate(() => ({ ground: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.body).color, scheme: getComputedStyle(document.documentElement).colorScheme }));
    expect(colours).toEqual({ ground: "rgb(255, 255, 255)", ink: "rgb(34, 35, 37)", scheme: "light" });
  });
});

test.describe("no console errors", () => {
  for (const path of ["/", "/search", "/login?role=client"]) {
    test(`no errors or hydration warnings while toggling on ${path}`, async ({ page }) => {
      const problems = watchConsole(page);
      await page.goto(path);
      await settled(page);
      await toggle(page).click();
      await expect.poll(() => themeOf(page)).toBe("dark");
      await toggle(page).click();
      await expect.poll(() => themeOf(page)).toBe("light");
      await toggle(page).click();
      await expect.poll(() => themeOf(page)).toBe("dark");
      await page.reload(); // the server renders it dark: that render must hydrate cleanly too
      await settled(page);
      expect(await themeOf(page)).toBe("dark");
      expect(problems).toEqual([]);
    });
  }
});

test.describe("signed in", () => {
  test("the choice survives sign-in and sign-out, and the toggle works for a signed-in user", async ({ page, context }) => {
    const problems = watchConsole(page);
    await page.goto("/login?role=client");
    await settled(page);
    await toggle(page).click();
    await expect.poll(() => themeOf(page)).toBe("dark");

    await login(page, "client@demo.test");
    await settled(page);
    expect(await themeOf(page)).toBe("dark");
    expect((await themeCookie(context))?.value).toBe("dark");
    await expect(page.getByRole("button", { name: TO_LIGHT })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Hisob menyusi/ })).toBeVisible(); // really signed in (the account menu is the signed-in header)

    // Flip it as a signed-in user, and go to another page: the choice stays.
    await toggle(page).click();
    await expect.poll(() => themeOf(page)).toBe("light");
    await page.goto("/orders");
    await settled(page);
    expect(await themeOf(page)).toBe("light");
    await expect(page.getByRole("button", { name: TO_DARK })).toBeVisible();

    // Signing out refreshes the header from the server: the scheme and the button agree with the cookie.
    await page.getByRole("button", { name: /^Hisob menyusi/ }).click();
    await page.getByRole("menuitem", { name: "Chiqish" }).click();
    await expect(page).toHaveURL(/\/$/);
    await settled(page);
    expect(await themeOf(page)).toBe("light");
    await expect(page.getByRole("button", { name: TO_DARK })).toBeVisible();
    expect(problems).toEqual([]);
  });
});

test.describe("on a phone (390 px wide)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("the toggle is visible next to Menyu, not inside it, and works for signed-out and signed-in visitors (next to the account menu once signed in)", async ({ page, context }) => {
    await page.goto("/");
    await settled(page);
    const menu = page.locator("header summary", { hasText: "Menyu" });
    await expect(menu).toBeVisible();
    await expect(toggle(page)).toBeVisible();
    // It is not in the folded menu: it is outside the <details>.
    expect(await toggle(page).evaluate((el) => !!el.closest("details"))).toBe(false);

    const t = (await toggle(page).boundingBox())!;
    const m = (await menu.boundingBox())!;
    expect(t.width).toBeGreaterThanOrEqual(44);
    expect(t.height).toBeGreaterThanOrEqual(44);
    expect(t.x + t.width).toBeLessThanOrEqual(m.x); // to the left of Menyu...
    expect(m.x - (t.x + t.width)).toBeLessThanOrEqual(16); // ...right next to it
    expect(Math.abs(t.y + t.height / 2 - (m.y + m.height / 2))).toBeLessThanOrEqual(2); // on the same line
    expect(m.x + m.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390); // no sideways scroll

    await toggle(page).tap();
    await expect.poll(() => themeOf(page)).toBe("dark");
    expect((await themeCookie(context))?.value).toBe("dark");

    // Signed in on the phone: the choice is still dark and the button is still there.
    await login(page, "client@demo.test");
    await settled(page);
    expect(await themeOf(page)).toBe("dark");
    await expect(toggle(page)).toBeVisible();
    // A signed-in phone has the account menu where signed-out visitors have Menyu, and the scheme button is still beside it.
    const account = page.getByRole("button", { name: /^Hisob menyusi/ });
    await expect(account).toBeVisible();
    await expect(menu).toHaveCount(0);
    const scheme = (await toggle(page).boundingBox())!;
    expect(scheme.x + scheme.width).toBeLessThanOrEqual((await account.boundingBox())!.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await toggle(page).tap();
    await expect.poll(() => themeOf(page)).toBe("light");
  });
});
