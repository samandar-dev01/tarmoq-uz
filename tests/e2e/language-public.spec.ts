import { request as pwRequest, test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { shortName } from "../../src/lib/format";
import { bannedIn } from "../bannedPaymentWords";
import { settled } from "./helpers";

// The PUBLIC half of the language work: the home page, the search and a creator's page in Russian, and everything a
// crawler reads (canonical, hreflang, Open Graph, JSON-LD, the sitemap, the 404 page), plus the proof that with Russian off
// nothing changed. (The language button, the cookie and the shell are tests/e2e/language-core.spec.ts.)
//
// Russian is behind one switch and is OFF on the app every other spec uses. So, like language-core.spec.ts, two halves:
//   - "Russian off": on the default app. The Uzbek pages carry no hreflang and no /ru link, and /ru/... is a 404.
//   - "Russian on":  on the second copy of the same build (RUSSIAN_LIVE=1) that the rig starts, address in E2E_RU_BASE_URL.
//     Without that variable (plain `npm run test:e2e`) this half skips itself.
// Needs the seeded demo data: jasur-karimov, madina-yusupova, bobur-tursunov and dilshod-rahimov are APPROVED.
// Only GET requests and read-only database queries: nothing here depends on a rate-limit counter.

const RU_BASE = process.env.E2E_RU_BASE_URL;
const CYRILLIC = /[А-Яа-яЁё]/;
const UZ_APOSTROPHE = /[ʻʼ]/;
const CRAWLER = { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" };
const PUBLIC_PAGES = ["/ru", "/ru/search", "/ru/providers/jasur-karimov"] as const;

// ---------- reading the HTML a crawler gets ----------

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const htmlTag = (html: string) => /<html\b[^>]*>/.exec(html)?.[0] ?? "";
const tagsOf = (html: string, name: string) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))].map((m) => m[0]);
const attrOf = (tag: string, name: string) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag); // React writes hrefLang, not hreflang
  return m ? decode(m[1]!) : undefined;
};
/** The address as `/path?query`, whatever host the page wrote (APP_URL is the Uzbek app's address, not the Russian copy's). */
const pathOf = (url: string) => {
  const u = new URL(url, "http://x.invalid");
  return u.pathname + u.search;
};
const titleOf = (html: string) => decode(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "");
const canonicalOf = (html: string) => tagsOf(html, "link").map((t) => (attrOf(t, "rel") === "canonical" ? attrOf(t, "href") : undefined)).find(Boolean);
const alternatesOf = (html: string) =>
  Object.fromEntries(tagsOf(html, "link").filter((t) => attrOf(t, "rel") === "alternate" && attrOf(t, "hreflang")).map((t) => [attrOf(t, "hreflang")!, attrOf(t, "href")!]));
const metaOf = (html: string, key: string) => {
  const tag = tagsOf(html, "meta").find((t) => attrOf(t, "property") === key || attrOf(t, "name") === key);
  return tag ? attrOf(tag, "content") : undefined;
};
const hrefsOf = (html: string) => tagsOf(html, "a").map((t) => attrOf(t, "href")).filter((h): h is string => h !== undefined);
function jsonLdOf(html: string): Record<string, any>[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));
}
const nodesOf = (blocks: Record<string, any>[]) => blocks.flatMap((b) => (Array.isArray(b["@graph"]) ? b["@graph"] : [b]));
const textOf = (html: string) => decode(html.replace(/<script\b[\s\S]*?<\/script>/g, " ").replace(/<style\b[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

/** A public path: the home page, the search or a creator's page (with or without the language prefix). */
const isPublic = (path: string) => /^\/(ru)?$/.test(path) || /^\/(ru\/)?search$/.test(path) || /^\/(ru\/)?providers\/[^/]+$/.test(path);

/** A new visitor each time, like a crawler: no cookie jar, a crawler's user agent. */
async function crawler(): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: RU_BASE, extraHTTPHeaders: CRAWLER });
}

function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !m.text().startsWith("Failed to load resource")) problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

test.describe("Russian off (the live site today): the public pages are what they were", () => {
  const ASKING = { cookie: "lang=ru", "x-locale": "ru" };

  test("home, search and a creator's page are Uzbek, self-canonical, with no hreflang, no ru_RU and no /ru link, even when Russian is asked for", async ({ request }) => {
    for (const path of ["/", "/search", "/search?category=photography", "/providers/jasur-karimov"]) {
      for (const headers of [{}, ASKING]) {
        const res = await request.get(path, { headers });
        expect(res.status(), path).toBe(200);
        const html = await res.text();
        expect(htmlTag(html), path).toContain('lang="uz"');
        expect(Object.keys(alternatesOf(html)), `${path}: hreflang while Russian is off`).toEqual([]);
        expect(html.toLowerCase(), path).not.toContain("hreflang");
        expect(pathOf(canonicalOf(html)!), path).toBe(path.startsWith("/search") && !path.includes("category") ? "/search" : path);
        expect(metaOf(html, "og:locale"), path).toBe("uz_UZ");
        expect(html, path).not.toContain("ru_RU");
        expect(html, path).not.toContain('href="/ru');
        expect(hrefsOf(html).filter((h) => h.startsWith("/ru")), path).toEqual([]);
        expect(CYRILLIC.test(textOf(html)), `${path}: Cyrillic text`).toBe(false);
      }
    }
    // The words themselves are the ones the suite has always looked for.
    const home = await (await request.get("/")).text();
    expect(titleOf(home)).toBe("Tarmoq.uz: Oʻzbekistondagi videograf, fotograf va montajchilar");
    expect(home).toContain("Ijodkorni shu yerdan toping.");
    expect(jsonLdOf(home).find((b) => b["@type"] === "WebSite")!.inLanguage).toBe("uz");
    expect(JSON.stringify(jsonLdOf(home).find((b) => b["@type"] === "FAQPage"))).not.toContain("inLanguage");
  });

  test("/ru, /ru/search and a creator's /ru page do not exist: a 404 in Uzbek, for a plain request and a Russian-asking one", async ({ request }) => {
    for (const path of ["/ru", "/ru/search", "/ru/search?category=photography", "/ru/providers/jasur-karimov"]) {
      for (const headers of [{}, ASKING]) {
        const res = await request.get(path, { maxRedirects: 0, headers });
        expect(res.status(), path).toBe(404);
        const html = await res.text();
        expect(html, path).toContain("Sahifa topilmadi");
        expect(htmlTag(html), path).toContain('lang="uz"');
        expect(html, path).not.toContain("Страница не найдена");
      }
    }
  });

  test("the sitemap lists the Uzbek pages only, with no alternates", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => pathOf(decode(m[1]!)));
    expect(locs).toContain("/");
    expect(locs).toContain("/search");
    expect(locs).toContain("/providers/jasur-karimov");
    expect(locs.filter((p) => p.startsWith("/ru"))).toEqual([]);
    expect(xml).not.toContain("xhtml:link");
    expect(xml.toLowerCase()).not.toContain("hreflang");
  });

  test("the 404 page stays Uzbek and links to the Uzbek home page", async ({ request }) => {
    const res = await request.get("/no-such-page-anywhere", { headers: ASKING });
    expect(res.status()).toBe(404);
    const html = await res.text();
    expect(html).toContain("Sahifa topilmadi");
    expect(titleOf(html)).toBe("Sahifa topilmadi · Tarmoq.uz");
    expect(hrefsOf(html)).toContain("/");
    expect(CYRILLIC.test(textOf(html))).toBe(false);
  });
});

test.describe("Russian on (second copy of the build, RUSSIAN_LIVE=1)", () => {
  test.skip(!RU_BASE, "E2E_RU_BASE_URL is not set: run through the production-style rig (scripts/e2e-prod/README.md).");
  test.use({ baseURL: RU_BASE });

  test("(a) each Russian page is 200, Russian, self-canonical at its /ru address, and names the uz/ru/x-default pair", async () => {
    const expected: Record<string, { title: RegExp | string; h: string[]; uz: string }> = {
      "/ru": {
        title: "Tarmoq.uz: видеографы, фотографы и монтажёры Узбекистана",
        h: ["Найдите креатора здесь.", "Лучшие креаторы", "Как работает заказ", "Почему Tarmoq.uz?", "Частые вопросы", "Вы креатор? Вас ждут заказы."],
        uz: "/",
      },
      "/ru/search": { title: "Найдите креаторов · Tarmoq.uz", h: ["Найдите креаторов", "Фильтруйте по городу, направлению и цене."], uz: "/search" },
      "/ru/providers/jasur-karimov": { title: "Jasur Karimov · Tarmoq.uz", h: ["О креаторе", "Пакеты", "Портфолио", "Отзывы", "Защищённый заказ"], uz: "/providers/jasur-karimov" },
    };
    for (const path of PUBLIC_PAGES) {
      const c = await crawler();
      const res = await c.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(200);
      const html = await res.text();
      expect(htmlTag(html), path).toContain('lang="ru"');
      expect(titleOf(html), path).toBe(expected[path]!.title);
      const body = textOf(html);
      for (const h of expected[path]!.h) expect(body, `${path}: ${h}`).toContain(h);

      // Self-canonical in Russian, and the pair of languages (the same on the Uzbek page).
      expect(pathOf(canonicalOf(html)!), path).toBe(path);
      expect(metaOf(html, "og:url") && pathOf(metaOf(html, "og:url")!), path).toBe(path);
      expect(metaOf(html, "og:locale"), path).toBe("ru_RU");
      const alt = alternatesOf(html);
      expect(Object.keys(alt).sort(), path).toEqual(["ru", "uz", "x-default"]);
      expect(pathOf(alt.uz!), path).toBe(expected[path]!.uz);
      expect(pathOf(alt.ru!), path).toBe(path);
      expect(pathOf(alt["x-default"]!), path).toBe(expected[path]!.uz);
      await c.dispose();
    }

    // The Uzbek address of the same pages (while Russian is on) is Uzbek, self-canonical, with the same pair.
    for (const path of ["/", "/search", "/providers/jasur-karimov"]) {
      const c = await crawler();
      const html = await (await c.get(path)).text();
      expect(htmlTag(html), path).toContain('lang="uz"');
      expect(pathOf(canonicalOf(html)!), path).toBe(path);
      expect(metaOf(html, "og:locale"), path).toBe("uz_UZ");
      const alt = alternatesOf(html);
      expect(pathOf(alt.uz!), path).toBe(path);
      expect(pathOf(alt.ru!), path).toBe(path === "/" ? "/ru" : `/ru${path}`);
      expect(pathOf(alt["x-default"]!), path).toBe(path);
      expect(hrefsOf(html).filter((h) => h.startsWith("/ru")), `${path}: an Uzbek page has no /ru link`).toEqual([]);
      await c.dispose();
    }
  });

  test("(a) a category's search page: self-canonical at /ru/search?category=..., indexable, with the pair", async () => {
    const c = await crawler();
    const html = await (await c.get("/ru/search?category=photography")).text();
    expect(titleOf(html)).toBe("Фотография: найдите креаторов · Tarmoq.uz");
    expect(pathOf(canonicalOf(html)!)).toBe("/ru/search?category=photography");
    expect(metaOf(html, "robots")).toBeUndefined();
    const alt = alternatesOf(html);
    expect(pathOf(alt.uz!)).toBe("/search?category=photography");
    expect(pathOf(alt.ru!)).toBe("/ru/search?category=photography");
    expect(pathOf(alt["x-default"]!)).toBe("/search?category=photography");
    // Any other cut of the list is noindex and points at /ru/search.
    const cut = await (await c.get("/ru/search?city=Andijon")).text();
    expect(metaOf(cut, "robots")).toBe("noindex, follow");
    expect(pathOf(canonicalOf(cut)!)).toBe("/ru/search");
    await c.dispose();
  });

  test("(b) a visitor with no cookie sees only /ru links to public pages, and private links keep their one address", async () => {
    for (const path of [...PUBLIC_PAGES, "/ru/search?category=photography"]) {
      const c = await crawler();
      const res = await c.get(path);
      const html = await res.text();
      const hrefs = hrefsOf(html);
      expect(hrefs.length, path).toBeGreaterThan(5);
      const bare = hrefs.filter((h) => isPublic(pathOf(h)) && !pathOf(h).startsWith("/ru"));
      expect(bare, `${path}: public links without /ru`).toEqual([]);
      // Private paths are never prefixed.
      expect(hrefs.filter((h) => /^\/ru\/(login|register|orders|dashboard|messages|checkout|admin|settings|forbidden|api)/.test(h)), path).toEqual([]);
      expect(hrefs, path).toContain("/ru"); // the logo
      expect(hrefs, path).toContain("/ru/search");
      expect(hrefs, path).toContain("/login?role=client");
      // Every card and every pill leads to a /ru address.
      const cards = hrefs.filter((h) => /^\/(ru\/)?providers\//.test(h));
      if (path === "/ru" || path === "/ru/search") expect(cards.length, path).toBeGreaterThanOrEqual(4);
      for (const h of cards) expect(h, path).toMatch(/^\/ru\/providers\/[a-z0-9-]+$/);
      for (const h of hrefs.filter((x) => x.includes("category="))) expect(h, path).toMatch(/^\/ru\/search\?/);
      // The search form itself submits to the Russian search page.
      for (const f of tagsOf(html, "form").map((t) => attrOf(t, "action")).filter(Boolean)) expect(f, path).toBe("/ru/search");
      await c.dispose();
    }
  });

  test("(b) the Russian 404 page, drawn in a browser, links only to /ru addresses for public pages", async ({ page }) => {
    // (A creator that does not exist answers 404 with the page drawn by the browser from the stream, so its links are read from the page.)
    const res = await page.goto("/ru/providers/no-such-creator");
    expect(res!.status()).toBe(404);
    await settled(page);
    const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThan(5);
    expect(hrefs.filter((h) => isPublic(pathOf(h)) && !pathOf(h).startsWith("/ru"))).toEqual([]);
    expect(hrefs).toContain("/ru");
    expect(hrefs).toContain("/ru/search");
  });

  test("(b) the links a crawler follows from the home page and from a card really lead to Russian pages", async () => {
    const c = await crawler();
    const home = await (await c.get("/ru")).text();
    const card = hrefsOf(home).find((h) => /^\/ru\/providers\//.test(h))!;
    for (const path of [card, "/ru/search", ...hrefsOf(home).filter((h) => h.startsWith("/ru/search?category=")).slice(0, 2)]) {
      const res = await c.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(200);
      expect(htmlTag(await res.text()), path).toContain('lang="ru"');
    }
    await c.dispose();
  });

  test("(c) the JSON-LD parses, is Russian (inLanguage ru), the FAQ is Russian and is what the page shows, and the addresses are /ru", async () => {
    const c = await crawler();
    const home = await (await c.get("/ru")).text();
    const found = nodesOf(jsonLdOf(home));
    expect(found.map((n) => n["@type"]).sort()).toEqual(["FAQPage", "Organization", "WebSite"]);
    const site = found.find((n) => n["@type"] === "WebSite")!;
    expect(site.inLanguage).toBe("ru");
    expect(pathOf(site.url)).toBe("/ru");
    expect(pathOf(site.potentialAction.target.urlTemplate.replace("{search_term_string}", "x"))).toBe("/ru/search?q=x");
    const org = found.find((n) => n["@type"] === "Organization")!;
    expect(org.description).toMatch(CYRILLIC);
    const faq = found.find((n) => n["@type"] === "FAQPage")!;
    expect(faq.inLanguage).toBe("ru");
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(3);
    const body = textOf(home);
    for (const q of faq.mainEntity) {
      expect(q.name, q.name).toMatch(CYRILLIC);
      expect(q.acceptedAnswer.text, q.name).toMatch(CYRILLIC);
      expect(q.name + q.acceptedAnswer.text).not.toMatch(UZ_APOSTROPHE);
      expect(body).toContain(q.name);
      expect(body).toContain(q.acceptedAnswer.text);
    }

    const search = nodesOf(jsonLdOf(await (await c.get("/ru/search?category=photography")).text()));
    const crumbs = search.find((n) => n["@type"] === "BreadcrumbList")!;
    expect(crumbs.itemListElement.map((i: any) => [i.name, pathOf(i.item)])).toEqual([
      ["Главная", "/ru"],
      ["Найдите креаторов", "/ru/search"],
      ["Фотография", "/ru/search?category=photography"],
    ]);
    for (const item of search.find((n) => n["@type"] === "ItemList")!.itemListElement) expect(pathOf(item.url)).toMatch(/^\/ru\/providers\/[a-z0-9-]+$/);

    const creator = nodesOf(jsonLdOf(await (await c.get("/ru/providers/jasur-karimov")).text()));
    const page = creator.find((n) => n["@type"] === "ProfilePage")!;
    expect(page.inLanguage).toBe("ru");
    expect(pathOf(page.url)).toBe("/ru/providers/jasur-karimov");
    const person = creator.find((n) => n["@type"] === "Person")!;
    expect(person.name).toBe("Jasur Karimov"); // the creator's own name, as written
    expect(person.address.addressLocality).toBe("Андижан");
    expect(person.jobTitle).toBe("Мобильная съёмка");
    expect(person.knowsLanguage).toEqual(expect.arrayContaining(["Узбекский", "Русский"]));
    const service = creator.find((n) => n["@type"] === "Service")!;
    expect(service.offers.length).toBeGreaterThan(0);
    for (const offer of service.offers) {
      expect(offer.priceCurrency).toBe("UZS");
      expect(pathOf(offer.url)).toBe("/ru/providers/jasur-karimov");
    }
    expect(creator.find((n) => n["@type"] === "BreadcrumbList")!.itemListElement.map((i: any) => pathOf(i.item))).toEqual(["/ru", "/ru/search", "/ru/providers/jasur-karimov"]);
    // A rating is only claimed when the page shows reviews.
    const shows = (await (await c.get("/ru/providers/jasur-karimov")).text()).includes("Пока нет отзывов");
    if (shows) expect(service.aggregateRating).toBeUndefined();
    else expect(service.aggregateRating.reviewCount).toBeGreaterThan(0);
    await c.dispose();
  });

  test("(c) no payment promise in the title, the meta tags, the canonical link or any JSON-LD of a Russian page (Uzbek and Russian words)", async () => {
    const c = await crawler();
    for (const path of ["/ru", "/ru/search", "/ru/search?category=photography", "/ru/providers/jasur-karimov"]) {
      const html = await (await c.get(path)).text();
      const texts = [
        titleOf(html),
        ...tagsOf(html, "meta").map((t) => attrOf(t, "content") ?? ""),
        ...tagsOf(html, "link").filter((t) => ["canonical", "alternate"].includes(attrOf(t, "rel") ?? "")).map((t) => attrOf(t, "href") ?? ""),
        ...[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]!),
      ];
      expect(texts.length, path).toBeGreaterThan(8);
      for (const t of texts) expect(bannedIn(t), `${path}: ${t.slice(0, 90)}`).toEqual([]);
    }
    await c.dispose();
  });

  test("(d) the sitemap lists the Russian pages too, and every entry names uz, ru and x-default", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => {
      const block = m[1]!;
      const loc = pathOf(decode(/<loc>([^<]+)<\/loc>/.exec(block)![1]!));
      const alternates = Object.fromEntries([...block.matchAll(/<xhtml:link\b[^>]*>/g)].map((t) => [attrOf(t[0], "hreflang")!, pathOf(attrOf(t[0], "href")!)]));
      return { loc, alternates };
    });
    const locs = entries.map((e) => e.loc);
    for (const p of ["/", "/search", "/search?category=photography", "/providers/jasur-karimov", "/ru", "/ru/search", "/ru/search?category=photography", "/ru/providers/jasur-karimov"]) {
      expect(locs, p).toContain(p);
    }
    // Every Uzbek page has its Russian twin and the other way round, and nothing private is listed.
    for (const e of entries) {
      const uz = e.loc.startsWith("/ru") ? (e.loc === "/ru" ? "/" : e.loc.slice(3)) : e.loc;
      const ru = uz === "/" ? "/ru" : `/ru${uz}`;
      expect(e.alternates, e.loc).toEqual({ uz, ru, "x-default": uz });
      expect(isPublic(e.loc.split("?")[0]!), e.loc).toBe(true);
    }
    expect(locs.filter((p) => p.startsWith("/ru")).length).toBe(locs.filter((p) => !p.startsWith("/ru")).length);
    expect(xml).not.toMatch(/<loc>[^<]*\/(login|register|orders|dashboard|admin|messages|checkout|api)\b/);
    // robots.txt still points at the one sitemap and keeps the private paths closed.
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m);
    expect(robots).toContain("Disallow: /login");
    expect(robots).not.toMatch(/^Disallow: \/$/m);
    expect(robots).not.toMatch(/Disallow: \/ru/);
  });

  test("(e) an unknown creator at a /ru address is a Russian 404 with a way to the Russian home page", async ({ page }) => {
    // A crawler gets the 404 status and no cookie is needed for the language: the address says it.
    const c = await crawler();
    const res = await c.get("/ru/providers/no-such-creator", { maxRedirects: 0 });
    expect(res.status()).toBe(404);
    await c.dispose();

    // The page itself, in a browser (for this kind of 404 Next sends the page as a stream the browser draws).
    const problems = watchConsole(page);
    const nav = await page.goto("/ru/providers/no-such-creator");
    expect(nav!.status()).toBe(404);
    await settled(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    // The tab title is the creator page's own (an unknown creator is "Профиль креатора", marked noindex), as in Uzbek.
    await expect(page).toHaveTitle("Профиль креатора · Tarmoq.uz");
    await expect(page.getByRole("heading", { level: 1, name: "Страница не найдена" })).toBeVisible();
    await expect(page.getByText("По этому адресу страницы нет")).toBeVisible();
    const shown = await page.locator("main").innerText();
    expect(CYRILLIC.test(shown)).toBe(true);
    expect(UZ_APOSTROPHE.test(shown)).toBe(false);
    await page.getByRole("link", { name: "Вернуться на главную" }).click();
    await expect(page).toHaveURL(new RegExp(`^${RU_BASE}/ru$`));
    await expect(page.getByRole("heading", { level: 1, name: "Найдите креатора здесь." })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("(e) a visitor who chose Russian gets a Russian 404 on any unknown address", async ({ request }) => {
    const res = await request.get("/no-such-page-anywhere", { headers: { cookie: "lang=ru" } });
    expect(res.status()).toBe(404);
    const html = await res.text();
    expect(htmlTag(html)).toContain('lang="ru"');
    expect(html).toContain("Страница не найдена");
    expect(titleOf(html)).toBe("Страница не найдена · Tarmoq.uz");
    expect(hrefsOf(html)).toContain("/ru");
    // And an Uzbek one stays Uzbek.
    const uz = await (await request.get("/no-such-page-anywhere", { headers: { cookie: "lang=uz" } })).text();
    expect(uz).toContain("Sahifa topilmadi");
  });

  test("(f) no Uzbek is left on the Russian pages: no apostrophe letters and no Latin word, apart from what a creator wrote", async ({ page }) => {
    const prisma = new PrismaClient();
    // Everything creators and clients wrote that the public pages may show as written.
    const profiles = await prisma.providerProfile.findMany({ include: { user: { select: { name: true } }, services: true, portfolio: true } });
    const reviews = await prisma.review.findMany({ select: { comment: true, author: { select: { name: true } } } });
    await prisma.$disconnect();
    const written = [
      ...profiles.flatMap((p) => [p.user.name, p.headline, p.bio, p.district ?? "", p.equipment ?? "", ...p.services.flatMap((s) => [s.title, s.description ?? ""]), ...p.portfolio.map((i) => i.title)]),
      ...reviews.flatMap((r) => [r.comment, r.author.name, shortName(r.author.name)]),
    ]
      .flatMap((s) => s.split(/\n+/))
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => s.length > 0)
      .sort((a, b) => b.length - a.length);
    expect(written.length).toBeGreaterThan(10);

    const problems = watchConsole(page);
    for (const path of [...PUBLIC_PAGES, "/ru/search?category=photography", "/ru/search?q=zzzz-nothing-matches"]) {
      await page.goto(path);
      await settled(page);
      // What a reader sees (innerText leaves out scripts and hidden things) plus what only a screen reader or a hover shows.
      const seen = await page.evaluate(() => {
        const attrs = [...document.querySelectorAll("[placeholder],[aria-label],[title]")].flatMap((el) => ["placeholder", "aria-label", "title"].map((a) => el.getAttribute(a) ?? ""));
        const options = [...document.querySelectorAll("option")].map((o) => o.textContent ?? "");
        return [document.body.innerText, ...attrs, ...options, document.title].join("\n");
      });
      let text = ` ${seen.replace(/\s+/g, " ")} `;
      for (const piece of written) text = text.split(piece).join(" ");
      // The language button's name ends with the other language's own name («Сменить язык: Oʻzbekcha»): on purpose, so that a reader of either language can find it.
      text = text.split("Сменить язык: Oʻzbekcha").join(" ");
      const apostrophes = text.match(/.{0,40}[ʻʼ].{0,40}/g) ?? [];
      expect(apostrophes, `${path}: Uzbek apostrophe letters left`).toEqual([]);
      // A leftover Latin word is an untranslated Uzbek sentence (the brand name is the one allowed word).
      const latin = (text.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => w.toLowerCase() !== "tarmoq");
      expect(latin, `${path}: Latin words left (Uzbek that nobody translated?)`).toEqual([]);
      expect(CYRILLIC.test(text), path).toBe(true);
    }
    expect(problems).toEqual([]);
  });

  test("(f) the creator's page shows the stored values in Russian: city, category, working languages, prices, package facts", async ({ page }) => {
    await page.goto("/ru/providers/jasur-karimov");
    await settled(page);
    const body = page.locator("main");
    await expect(body.getByText("Андижан", { exact: false }).first()).toBeVisible();
    await expect(body.getByText("Мобильная съёмка").first()).toBeVisible();
    await expect(body.getByText("Узбекский, Русский, Английский")).toBeVisible();
    await expect(body.getByText(/^от\s[\d\s]+сум$/)).toBeVisible();
    await expect(body.getByText(/^Срок: \d+ дн\.$/).first()).toBeVisible();
    await expect(body.getByText(/^Правок: \d+$/).first()).toBeVisible();
    await expect(body.getByText(/^[\d\s]+сум$/).first()).toBeVisible();
    // Ordering is for a signed-in client; a visitor is sent to sign in, and that page keeps its one address.
    const order = body.getByRole("link", { name: "Заказать" }).first();
    expect(await order.getAttribute("href")).toMatch(/^\/login\?role=client&next=/);
  });

  test("the Russian search works end to end: the filter panel, the pills, the cards, with the stored Uzbek values behind the Russian words", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto("/ru/search");
    await settled(page);
    await expect(page.getByText(/^Найдено: \d+ креатор(а|ов)?$/)).toBeVisible();
    const panel = page.locator("form[action='/ru/search']");
    await expect(panel.getByLabel("Город").locator("option")).toHaveText(["Все города", "Андижан", "Ташкент", "Самарканд", "Бухара", "Наманган", "Фергана", "Коканд", "Нукус", "Карши", "Термез"]);
    expect(await panel.getByLabel("Город").locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))).toContain("Andijon"); // the stored value is unchanged
    await expect(panel.getByLabel("Сортировка").locator("option")).toHaveText(["По рейтингу", "Цена: от низкой к высокой", "Цена: от высокой к низкой", "Сначала новые"]);

    // A search word and a city, in Russian words; the address stays /ru/search and the result is the same list as in Uzbek.
    await panel.getByLabel("Поиск").fill("Jasur Karimov");
    await panel.getByLabel("Город").selectOption({ label: "Андижан" });
    await panel.getByRole("button", { name: "Применить фильтры" }).click();
    await expect(page).toHaveURL(/\/ru\/search\?q=Jasur\+Karimov&city=Andijon/);
    await expect(page.getByText("Найдено: 1 креатор")).toBeVisible();
    await expect(page.locator("main a[href='/ru/providers/jasur-karimov']")).toHaveCount(1);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");

    // A category pill keeps the language, marks itself as current, and a card opens the creator's Russian page.
    await page.goto("/ru/search");
    await settled(page);
    const nav = page.getByRole("navigation", { name: "Все направления" });
    await nav.getByRole("link", { name: "Фотография" }).click();
    await expect(page).toHaveURL(/\/ru\/search\?sort=rating&category=photography$/);
    await expect(nav.getByRole("link", { name: "Фотография" })).toHaveAttribute("aria-current", "true");
    await page.goto("/ru/search");
    await settled(page);
    await page.locator("main a[href^='/ru/providers/']").first().click();
    await expect(page).toHaveURL(/\/ru\/providers\/[a-z0-9-]+$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.getByRole("heading", { name: "Пакеты" })).toBeVisible();

    // No match: the empty state is Russian and its button clears the filters at the Russian address.
    await page.goto("/ru/search?q=zzzz-nothing-matches");
    await settled(page);
    await expect(page.getByText("По этим фильтрам креаторов не найдено")).toBeVisible();
    await expect(page.getByText("Найдено: 0 креаторов")).toBeVisible();
    await page.getByRole("link", { name: "Сбросить фильтры" }).click();
    await expect(page).toHaveURL(/\/ru\/search$/);
    expect(problems).toEqual([]);
  });

  test("the header's own link to the search is marked as the current page on /ru/search, the same in the HTML and in the browser (no hydration mismatch)", async ({ page, request }) => {
    const html = await (await request.get("/ru/search")).text();
    const link = tagsOf(html, "a").find((t) => attrOf(t, "href") === "/ru/search" && (attrOf(t, "class") ?? "").includes("min-h-11") && (attrOf(t, "class") ?? "").includes("saffron"));
    expect(link, "the HTML marks it").toBeDefined();
    expect(attrOf(link!, "aria-current")).toBe("page");
    const problems = watchConsole(page);
    await page.goto("/ru/search");
    await settled(page);
    await expect(page.locator("header").getByRole("link", { name: "Креаторы" })).toHaveAttribute("aria-current", "page");
    expect(problems).toEqual([]);
  });

  test("Russian text fits: no sideways scroll at 1280, 390 and 360 px, in both colour schemes", async ({ page }) => {
    for (const scheme of ["dark", "light"]) {
      await page.context().addCookies([{ name: "theme", value: scheme, url: RU_BASE! }]);
      for (const width of [1280, 390, 360]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of [...PUBLIC_PAGES, "/ru/providers/no-such-creator"]) {
          await page.goto(path);
          await settled(page);
          const where = `${path} ${scheme} ${width}px`;
          expect(await page.evaluate(() => document.documentElement.scrollWidth), where).toBeLessThanOrEqual(width);
          // Nothing wider than the screen: no card, chip or button pokes out of the right edge.
          const out = await page.evaluate(
            (w) =>
              [...document.querySelectorAll("main a, main button, main h1, main h2, main h3, main p, main select, main input, main dd")]
                .filter((el) => !el.closest("[aria-hidden='true']") && el.getBoundingClientRect().right > w + 1)
                .map((el) => `${el.tagName} ${(el.textContent ?? "").slice(0, 40)}`)
                .slice(0, 5),
            width,
          );
          expect(out, where).toEqual([]);
        }
      }
    }
  });
});
