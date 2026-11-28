import { request as pwRequest, test, expect, type Page } from "@playwright/test";
import { PASSWORD, settled } from "./helpers";

// The language machinery of the core branch: the one language button, the `lang` cookie, the `/ru` addresses, the
// shell and the sign-in pages in Russian, and a server error translated at the boundary.
//
// Russian is behind one switch (RUSSIAN_LIVE in src/i18n/config.ts) and is OFF. So this spec has two halves:
//   - "Russian off": on the app every other spec uses. Nothing Russian may be reachable.
//   - "Russian on":  on a second copy of the same build started with RUSSIAN_LIVE=1. The production-style rig starts it
//     and gives its address in E2E_RU_BASE_URL (scripts/e2e-prod/README.md, "Russian"). Without that variable (plain
//     `npm run test:e2e`) this half skips itself.

const RU_BASE = process.env.E2E_RU_BASE_URL;
const CYRILLIC = /[А-Яа-яЁё]/;
const htmlTag = (html: string) => /<html\b[^>]*>/.exec(html)?.[0] ?? "";
const headerOf = (html: string) => html.slice(html.indexOf("<header"), html.indexOf("</header>"));
const footerOf = (html: string) => html.slice(html.indexOf("<footer"), html.indexOf("</footer>"));
const langToggle = (page: Page) => page.locator("header").getByRole("button", { name: /^(Tilni almashtirish|Сменить язык): / });

function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    // The browser logs every refused request (the wrong password below is one); those are meant. A hydration mismatch is not.
    if ((m.type() === "error" || m.type() === "warning") && !m.text().startsWith("Failed to load resource")) problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

test.describe("Russian off (the live site today)", () => {
  const ASKING = { cookie: "lang=ru", "x-locale": "ru" };

  test("pages are Uzbek and have no language button, even for a request that asks for Russian", async ({ request }) => {
    for (const path of ["/", "/search", "/login?role=client", "/register?role=provider", "/forbidden"]) {
      const plain = await (await request.get(path)).text();
      const asked = await (await request.get(path, { headers: ASKING })).text();
      for (const html of [plain, asked]) {
        expect(htmlTag(html), path).toContain('lang="uz"');
        expect(html, path).not.toContain("Tilni almashtirish");
        expect(html, path).not.toContain("Сменить язык");
        expect(CYRILLIC.test(headerOf(html) + footerOf(html)), `${path}: Cyrillic in the shell`).toBe(false);
        expect(html, path).not.toContain('href="/ru');
      }
    }
    const login = await (await request.get("/login?role=client", { headers: ASKING })).text();
    expect(CYRILLIC.test(login.replace(/<script\b[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " "))).toBe(false);
    expect(login).toContain("Mijoz sifatida kirish");
  });

  test("/ru addresses do not exist: a 404 in Uzbek, no redirect, no cookie", async ({ request }) => {
    for (const path of ["/ru", "/ru/search", "/ru/providers/jasur-karimov", "/ru/login"]) {
      const res = await request.get(path, { maxRedirects: 0, headers: ASKING });
      expect(res.status(), path).toBe(404);
      expect(res.headers()["set-cookie"] ?? "", path).not.toContain("lang=");
      const html = await res.text();
      expect(html, path).toContain("Sahifa topilmadi");
      expect(htmlTag(html), path).toContain('lang="uz"');
    }
  });

  test("the API answers in Uzbek whatever the request asks for", async ({ request }) => {
    const wrong = await request.post("/api/auth/login", { headers: ASKING, data: { email: "client@demo.test", password: "not-the-password" } });
    expect(wrong.status()).toBe(401);
    expect((await wrong.json()).error).toBe("Email yoki parol notoʻgʻri.");
    const empty = await request.post("/api/auth/login", { headers: ASKING, data: { email: "x", password: "" } });
    expect(await empty.json()).toMatchObject({ error: "Belgilangan maydonlarni tekshiring.", fieldErrors: { email: ["Email manzilini toʻgʻri kiriting"], password: ["Parolni kiriting"] } });
  });

  test("the header shows no language button in the browser", async ({ page, context }) => {
    await context.addCookies([{ name: "lang", value: "ru", url: test.info().project.use.baseURL! }]);
    await page.goto("/login?role=client");
    await settled(page);
    await expect(langToggle(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Mijoz sifatida kirish" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "uz");
  });
});

test.describe("Russian on (second copy of the build, RUSSIAN_LIVE=1)", () => {
  test.skip(!RU_BASE, "E2E_RU_BASE_URL is not set: run through the production-style rig (scripts/e2e-prod/README.md).");
  test.use({ baseURL: RU_BASE });

  const UZ_NAME = "Tilni almashtirish: Русский"; // what the button is called while the page is Uzbek
  const RU_NAME = "Сменить язык: Oʻzbekcha"; // and while it is Russian

  test("first visit is Uzbek, with the button offering Russian", async ({ request }) => {
    const res = await request.get("/login?role=client");
    const html = await res.text();
    expect(htmlTag(html)).toContain('lang="uz"');
    expect(res.headers()["set-cookie"] ?? "").not.toContain("lang=");
    expect(headerOf(html)).toMatch(new RegExp(`<button type="button" aria-label="${UZ_NAME}"[^>]*>RU</button>`));
    expect(html).toContain("Mijoz sifatida kirish");
  });

  test("/ru, /ru/search and a creator's /ru page are Russian for a visitor with no cookie, and link to /ru addresses", async ({ request }) => {
    for (const path of ["/ru", "/ru/search", "/ru/providers/jasur-karimov"]) {
      // A new visitor each time (a crawler): no cookie jar carried over from the page before.
      const crawler = await pwRequest.newContext({ baseURL: RU_BASE });
      const res = await crawler.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(200);
      expect(res.headers()["set-cookie"] ?? "", path).toMatch(/lang=ru; Path=\/; .*SameSite=lax/i);
      const html = await res.text();
      expect(htmlTag(html), path).toContain('lang="ru"');
      const header = headerOf(html);
      expect(header, path).toContain('href="/ru"'); // the logo
      expect(header, path).toMatch(/href="\/ru\/search"[^>]*>Креаторы</);
      expect(header, path).toContain("Войти как заказчик");
      expect(header, path).toContain("Войти как креатор");
      expect(header, path).toMatch(new RegExp(`<button type="button" aria-label="${RU_NAME}"[^>]*>UZ</button>`));
      expect(header, path).not.toMatch(/href="\/search"/);
      const footer = footerOf(html);
      expect(footer, path).toMatch(/href="\/ru\/search"[^>]*>Креаторы</);
      expect(footer, path).toContain("Стать креатором");
      expect(footer, path).toContain("Креаторы Узбекистана в одной сети");
      // Private pages keep their one address.
      expect(header, path).toContain('href="/login?role=client"');
      await crawler.dispose();
    }
    // A visitor who chose Uzbek keeps that cookie; the address still decides this page.
    const kept = await request.get("/ru/search", { headers: { cookie: "lang=uz" } });
    expect(kept.headers()["set-cookie"] ?? "").not.toContain("lang=");
    expect(htmlTag(await kept.text())).toContain('lang="ru"');
  });

  test("every other /ru/... address is a permanent redirect to the page's one address", async ({ request }) => {
    const cases: [string, string][] = [
      ["/ru/login?role=client", "/login?role=client"],
      ["/ru/register", "/register"],
      ["/ru/orders/abc", "/orders/abc"],
      ["/ru/messages", "/messages"],
      ["/ru/providers", "/providers"],
      ["/ru/ru/search", "/search"],
    ];
    for (const [from, to] of cases) {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status(), from).toBe(308);
      const location = new URL(res.headers()["location"]!, RU_BASE);
      expect(location.pathname + location.search, from).toBe(to);
    }
  });

  test("the cookie decides on pages with one address, and the API answers in the request's language", async ({ request }) => {
    const ru = { cookie: "lang=ru" };
    const login = await (await request.get("/login?role=provider", { headers: ru })).text();
    expect(htmlTag(login)).toContain('lang="ru"');
    expect(login).toContain("<title>Войти · Tarmoq.uz</title>");
    expect(login).toContain("Войти как креатор");
    expect(login).toContain("Здесь ваши заявки, заказы и выплаты.");
    const forbidden = await (await request.get("/forbidden", { headers: ru })).text();
    expect(forbidden).toContain("У вас нет доступа к этой странице");
    expect(forbidden).toContain("Вернуться на главную");

    const wrong = await request.post("/api/auth/login", { headers: ru, data: { email: "client@demo.test", password: "not-the-password" } });
    expect(wrong.status()).toBe(401);
    expect((await wrong.json()).error).toBe("Неверный email или пароль.");
    const door = await request.post("/api/auth/login", { headers: ru, data: { email: "jasur@demo.test", password: PASSWORD, role: "client" } });
    expect(door.status()).toBe(403);
    expect(await door.json()).toEqual({ error: "Это аккаунт креатора. Войдите через вход для креаторов.", details: { code: "WRONG_DOOR", door: "provider" } });
    const me = await request.get("/api/auth/me", { headers: ru });
    expect((await me.json()).error).toBe("Войдите, чтобы продолжить.");
    const uz = await request.post("/api/auth/login", { data: { email: "client@demo.test", password: "not-the-password" } });
    expect((await uz.json()).error).toBe("Email yoki parol notoʻgʻri.");
  });

  test("one press switches the sign-in page to Russian; it survives a reload, errors arrive in Russian, and so does the shell after signing in", async ({ page, context }) => {
    const problems = watchConsole(page);
    await page.goto("/login?role=client");
    await settled(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "uz");
    const toggle = langToggle(page);
    await expect(toggle).toHaveAccessibleName(UZ_NAME);
    await expect(toggle).toHaveText("RU");

    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page).toHaveURL(/\/login\?role=client$/); // a private page keeps its address
    await expect(page.getByRole("heading", { level: 1, name: "Войти как заказчик" })).toBeVisible();
    await expect(langToggle(page)).toHaveAccessibleName(RU_NAME);
    await expect(langToggle(page)).toHaveText("UZ");
    await expect(page.getByRole("navigation", { name: "Тип аккаунта" }).getByRole("link")).toHaveText(["Заказчик", "Креатор"]);
    await expect(page.getByLabel("Пароль")).toBeVisible();
    await expect(page.getByText("Впервые здесь?")).toBeVisible();
    await expect(page.locator("header").getByRole("button", { name: "Включить тёмную тему" })).toBeVisible();
    await expect(page).toHaveTitle("Войти · Tarmoq.uz");
    const cookie = (await context.cookies()).find((c) => c.name === "lang");
    expect(cookie?.value).toBe("ru");
    expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(300 * 24 * 3600);

    await page.reload();
    await settled(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.getByRole("heading", { level: 1, name: "Войти как заказчик" })).toBeVisible();

    // A field error and a server error, both from the API, both in Russian.
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Проверьте отмеченные поля.");
    await expect(page.getByText("Введите правильный email")).toBeVisible();
    await expect(page.getByText("Введите пароль")).toBeVisible();
    await page.getByLabel("Email").fill("client@demo.test");
    await page.getByLabel("Пароль").fill("not-the-password");
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Неверный email или пароль.");

    // The other sign-up page, then signing in: the choice follows.
    await page.getByRole("link", { name: "Зарегистрируйтесь" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Создайте аккаунт" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Хочу заказать/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Зарегистрироваться" })).toBeVisible();
    await page.getByRole("link", { name: "Войдите" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Войти как заказчик" })).toBeVisible();
    await page.getByLabel("Email").fill("client@demo.test");
    await page.getByLabel("Пароль").fill(PASSWORD);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/client/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    expect((await context.cookies()).find((c) => c.name === "lang")?.value).toBe("ru");

    const menu = page.locator("header").getByRole("button", { name: "Меню аккаунта: Demo Mijoz" });
    await menu.click();
    await expect(page.getByRole("menu").getByRole("menuitem")).toHaveText(["Кабинет", "Сообщения", "Креаторы", "Уведомления", "Настройки", "Помощь", "Выйти"]);
    await expect(page.getByRole("menu").locator("..").getByText("Заказчик", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("footer").getByRole("navigation", { name: "Нижнее меню" }).getByRole("link")).toHaveText(["Креаторы", "Кабинет", "Сообщения", "Помощь"]);
    expect(problems).toEqual([]);
  });

  test("on a public page the button moves between /search and /ru/search", async ({ page, context }) => {
    await page.goto("/search?city=Andijon");
    await settled(page);
    await langToggle(page).click();
    await expect(page).toHaveURL(/\/ru\/search\?city=Andijon$/);
    await settled(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    expect((await context.cookies()).find((c) => c.name === "lang")?.value).toBe("ru");
    await expect(page.locator("header").getByRole("link", { name: "Креаторы" })).toHaveAttribute("href", "/ru/search");
    // The cookie is the truth for people: the unprefixed address is Russian for them too, and the button still leads to Uzbek.
    await page.goto("/search");
    await settled(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await langToggle(page).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "uz");
    await expect(page).toHaveURL(/\/search$/);
    expect((await context.cookies()).find((c) => c.name === "lang")?.value).toBe("uz");
    // And from the Russian address back to the Uzbek one.
    await page.goto("/ru");
    await settled(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await langToggle(page).click();
    await expect(page).toHaveURL(new RegExp(`^${RU_BASE}/?$`));
    await settled(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "uz");
  });

  test("the button is 44 px, sits beside the theme button at every width, works from the keyboard, and Russian does not overflow a phone", async ({ page }) => {
    for (const width of [1280, 390, 360]) {
      await page.setViewportSize({ width, height: 800 });
      for (const lang of ["uz", "ru"]) {
        await page.context().addCookies([{ name: "lang", value: lang, url: RU_BASE! }]);
        for (const path of ["/", "/login?role=provider", "/register?role=client"]) {
          await page.goto(path);
          await settled(page);
          const where = `${path} ${lang} ${width}px`;
          const box = (await langToggle(page).boundingBox())!;
          expect(box.width, where).toBeGreaterThanOrEqual(44);
          expect(box.height, where).toBeGreaterThanOrEqual(44);
          const theme = (await page.locator("header").getByRole("button", { name: /rejimga oʻtish$|тему$/ }).boundingBox())!;
          expect(Math.abs(theme.y - box.y), where).toBeLessThanOrEqual(1);
          expect(box.x - (theme.x + theme.width), where).toBeGreaterThanOrEqual(0);
          expect(box.x - (theme.x + theme.width), where).toBeLessThanOrEqual(12);
          expect(box.x + box.width, where).toBeLessThanOrEqual(width);
          expect(await page.evaluate(() => document.documentElement.scrollWidth), where).toBeLessThanOrEqual(width);
        }
      }
    }
    // Keyboard: reach it with Tab, press Enter.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login?role=client");
    await settled(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    for (let i = 0; i < 12 && !(await langToggle(page).evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(langToggle(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("lang", "uz");
    await expect(page.getByRole("heading", { level: 1, name: "Mijoz sifatida kirish" })).toBeVisible();
    await expect(langToggle(page)).toHaveAccessibleName(UZ_NAME);
  });

  test("the admin area has no language button", async ({ page }) => {
    await page.goto("/login?role=admin");
    await settled(page);
    await expect(langToggle(page)).toHaveCount(1);
    await page.getByLabel("Email").fill("admin@demo.test");
    await page.getByLabel("Parol").fill(PASSWORD);
    await page.getByRole("button", { name: "Kirish", exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);
    await settled(page);
    await expect(page.locator("header").getByRole("button", { name: /rejimga oʻtish$/ })).toBeVisible();
    await expect(langToggle(page)).toHaveCount(0);
  });
});
