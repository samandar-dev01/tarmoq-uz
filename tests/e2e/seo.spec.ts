import { test, expect, type Page } from "@playwright/test";
import { apiAs } from "./helpers";

// Search and AI visibility: what crawlers are told (robots.txt, sitemap, llms.txt, response headers), what each public
// page says about itself (canonical, Open Graph, JSON-LD), and that no page promises anything about payments.
// Needs the seeded demo data: jasur-karimov, madina-yusupova, bobur-tursunov and dilshod-rahimov are APPROVED,
// sevara-aliyeva is PENDING_REVIEW.

const APPROVED = ["jasur-karimov", "madina-yusupova", "bobur-tursunov", "dilshod-rahimov"];

// The same words the unit test guards. Apostrophe look-alikes are removed first so every spelling matches.
const BANNED = [/tolov/, /оплат/, /платеж/, /escrow/, /pul himoya/, /kafolat/, /himoyalangan/];
const bannedIn = (text: string) => BANNED.filter((re) => re.test(text.toLowerCase().replace(/[ʻʼ'’‘`]/g, ""))).map(String);

/** Everything a crawler reads in the head: the title, every meta tag's content and the canonical link. */
async function headText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [document.title];
    document.querySelectorAll("meta[content]").forEach((m) => out.push(m.getAttribute("content") ?? ""));
    document.querySelectorAll('link[rel="canonical"]').forEach((l) => out.push(l.getAttribute("href") ?? ""));
    return out;
  });
}

/** Every <script type="application/ld+json"> on the page, parsed (a block that is not valid JSON fails the test here). */
async function jsonLdBlocks(page: Page): Promise<Record<string, any>[]> {
  const texts = await page.locator('script[type="application/ld+json"]').allTextContents();
  return texts.map((t) => JSON.parse(t));
}

/** The flat list of typed nodes: top-level objects, arrays and @graph members. */
function nodes(blocks: Record<string, any>[]): Record<string, any>[] {
  return blocks.flatMap((b) => (Array.isArray(b["@graph"]) ? b["@graph"] : [b]));
}

test.describe("robots.txt and sitemap.xml list only public pages", () => {
  test("robots.txt welcomes the AI crawlers, keeps private paths closed and points at the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/plain");
    const text = await res.text();
    expect(text).toMatch(/^User-Agent: GPTBot$/im);
    for (const bot of ["OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended"]) {
      expect(text).toContain(`User-Agent: ${bot}`);
    }
    for (const path of ["/api/", "/admin", "/dashboard", "/orders", "/checkout", "/messages", "/settings", "/login", "/register", "/forbidden"]) {
      expect(text).toContain(`Disallow: ${path}`);
    }
    expect(text).not.toMatch(/^Disallow: \/$/m); // the public site is not closed
    expect(text).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m);
  });

  test("sitemap.xml has the home page, the search, the categories and the approved creators, and nothing private", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("xml");
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!.replace(/&amp;/g, "&")));

    const paths = locs.map((u) => u.pathname + u.search);
    expect(paths).toContain("/");
    expect(paths).toContain("/search");
    expect(paths).toContain("/search?category=photography");
    for (const slug of APPROVED) expect(paths).toContain(`/providers/${slug}`);
    // A profile waiting for review is not public, so it is not listed.
    expect(xml).not.toContain("sevara-aliyeva");

    // Only the home page, the search (with a category) and creator pages.
    for (const u of locs) {
      const ok = u.pathname === "/" || (u.pathname === "/search" && (u.search === "" || /^\?category=[a-z0-9-]+$/.test(u.search))) || /^\/providers\/[a-z0-9-]+$/.test(u.pathname);
      expect(ok, u.href).toBe(true);
    }
    // Every address uses one host, the site's own address.
    expect(new Set(locs.map((u) => u.origin)).size).toBe(1);
  });
});

test.describe("public pages say who they are", () => {
  test("a creator page has a canonical address, Open Graph tags and valid JSON-LD", async ({ page }) => {
    await page.goto("/providers/jasur-karimov");
    await expect(page.getByRole("heading", { name: "Jasur Karimov" })).toBeVisible();

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toMatch(/^https?:\/\/[^/]+\/providers\/jasur-karimov$/);
    const meta = (property: string) => page.locator(`meta[property="${property}"]`).first().getAttribute("content");
    expect(await meta("og:title")).toBe("Jasur Karimov");
    expect(await meta("og:description")).toBeTruthy();
    expect(await meta("og:url")).toBe(canonical);
    expect(await meta("og:site_name")).toBe("Tarmoq.uz");
    expect(await meta("og:locale")).toBe("uz_UZ");
    expect(await meta("og:image")).toMatch(/^https?:\/\/[^/]+\/opengraph-image/);
    expect(await page.locator('meta[name="twitter:card"]').getAttribute("content")).toBe("summary_large_image");
    // An approved profile is indexable: no robots meta that says noindex.
    expect(await page.locator('meta[name="robots"]').count()).toBe(0);

    const found = nodes(await jsonLdBlocks(page));
    const byType = (t: string) => found.filter((n) => n["@type"] === t);
    expect(byType("ProfilePage")).toHaveLength(1);
    expect(byType("BreadcrumbList")).toHaveLength(1);
    const [person] = byType("Person");
    expect(person!.name).toBe("Jasur Karimov");
    expect(person!.address.addressLocality).toBe("Andijon");
    const [service] = byType("Service");
    expect(service!.offers.length).toBeGreaterThan(0);
    for (const offer of service!.offers) {
      expect(offer["@type"]).toBe("Offer");
      expect(offer.priceCurrency).toBe("UZS");
      expect(Number.isInteger(offer.price) && offer.price > 0).toBe(true);
    }
    for (const n of found) {
      if (n["@context"]) expect(n["@context"]).toBe("https://schema.org");
    }

    // A rating appears only when the page really shows reviews.
    const noReviews = await page.getByText("Hali sharhlar yoʻq").count();
    if (noReviews > 0) expect(service!.aggregateRating).toBeUndefined();
    else expect(service!.aggregateRating.reviewCount).toBeGreaterThan(0);
  });

  test("the home page has its own title, a canonical address, organisation data and a real FAQ", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.title()).toContain("Tarmoq.uz");
    expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toMatch(/^https?:\/\/[^/]+\/$/);

    const found = nodes(await jsonLdBlocks(page));
    expect(found.map((n) => n["@type"]).sort()).toEqual(["FAQPage", "Organization", "WebSite"]);
    const site = found.find((n) => n["@type"] === "WebSite")!;
    expect(site.potentialAction.target.urlTemplate).toMatch(/\/search\?q=\{search_term_string\}$/);

    // The FAQ is on the page, and the data repeats exactly what is shown.
    await expect(page.getByRole("heading", { name: "Koʻp beriladigan savollar" })).toBeVisible();
    const faq = found.find((n) => n["@type"] === "FAQPage")!;
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(3);
    for (const q of faq.mainEntity) {
      await expect(page.getByRole("heading", { name: q.name, exact: true })).toBeVisible();
      await expect(page.getByText(q.acceptedAnswer.text, { exact: true })).toBeVisible();
    }
  });

  test("only /search and a real category are indexable; every other filter is noindex and points at /search", async ({ page }) => {
    const robots = () => page.locator('meta[name="robots"]').getAttribute("content");
    const canonical = () => page.locator('link[rel="canonical"]').getAttribute("href");

    await page.goto("/search");
    expect(await canonical()).toMatch(/\/search$/);
    expect(await page.locator('meta[name="robots"]').count()).toBe(0);
    expect(nodes(await jsonLdBlocks(page)).map((n) => n["@type"]).sort()).toEqual(["BreadcrumbList", "ItemList"]);

    await page.goto("/search?category=photography");
    expect(await canonical()).toMatch(/\/search\?category=photography$/);
    expect(await page.locator('meta[name="robots"]').count()).toBe(0);

    for (const url of ["/search?q=reel", "/search?city=Andijon", "/search?sort=newest", "/search?category=photography&city=Andijon", "/search?category=no-such-category"]) {
      await page.goto(url);
      expect(await robots(), url).toBe("noindex, follow");
      expect(await canonical(), url).toMatch(/\/search$/);
    }
  });
});

test.describe("private pages are noindex", () => {
  const NOINDEX = "noindex, nofollow";

  test("the API and the signed-out pages carry X-Robots-Tag, with no redirect followed", async ({ request }) => {
    for (const path of ["/api/auth/me", "/api/admin/stats", "/api/providers", "/admin", "/orders", "/dashboard/client", "/messages", "/login", "/register", "/forbidden"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.headers()["x-robots-tag"], `${path} (HTTP ${res.status()})`).toBe(NOINDEX);
    }
  });

  test("signed-in pages carry it too, and the public pages do not", async ({ request }) => {
    const admin = await apiAs("admin@demo.test");
    for (const path of ["/admin", "/api/admin/stats"]) {
      const res = await admin.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(200);
      expect(res.headers()["x-robots-tag"], path).toBe(NOINDEX);
    }
    const client = await apiAs("client@demo.test");
    for (const path of ["/dashboard/client", "/orders", "/messages"]) {
      const res = await client.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(200);
      expect(res.headers()["x-robots-tag"], path).toBe(NOINDEX);
    }

    for (const path of ["/", "/search", "/providers/jasur-karimov", "/robots.txt", "/sitemap.xml", "/llms.txt"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(200);
      expect(res.headers()["x-robots-tag"], path).toBeUndefined();
    }
    await admin.dispose();
    await client.dispose();
  });
});

test.describe("unknown addresses", () => {
  test("an unknown URL shows the 404 page with a way home", async ({ page }) => {
    const res = await page.goto("/no-such-page-anywhere");
    expect(res!.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Sahifa topilmadi" })).toBeVisible();
    const home = page.getByRole("link", { name: "Bosh sahifaga qaytish" });
    await expect(home).toHaveAttribute("href", "/");
    await home.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("a creator that does not exist, or is not approved, is the same 404 page", async ({ page }) => {
    for (const slug of ["no-such-creator", "sevara-aliyeva"]) {
      await page.goto(`/providers/${slug}`);
      await expect(page.getByRole("heading", { name: "Sahifa topilmadi" }), slug).toBeVisible();
      await expect(page.getByRole("link", { name: "Bosh sahifaga qaytish" }), slug).toBeVisible();
    }
  });
});

test.describe("no payment promise where search engines and AI crawlers read", () => {
  test("the head of the home page, the search and a creator page, and all JSON-LD, are free of payment words", async ({ page }) => {
    for (const path of ["/", "/search", "/search?category=photography", "/providers/jasur-karimov"]) {
      await page.goto(path);
      const texts = [...(await headText(page)), ...(await page.locator('script[type="application/ld+json"]').allTextContents())];
      expect(texts.length, path).toBeGreaterThan(3);
      for (const t of texts) expect(bannedIn(t), `${path}: ${t.slice(0, 80)}`).toEqual([]);
    }
  });

  test("the manifest and the share picture are served", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    const m = await manifest.json();
    expect(m.name).toBe("Tarmoq.uz");
    expect(m.start_url).toBe("/");
    expect(bannedIn(JSON.stringify(m))).toEqual([]);

    const image = await request.get("/opengraph-image");
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
  });
});

test.describe("llms.txt", () => {
  test("is served as text, lists the approved creators only, and promises nothing about payments", async ({ request }) => {
    const res = await request.get("/llms.txt");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/text\/(markdown|plain)/);
    const text = await res.text();
    expect(text.startsWith("# Tarmoq.uz")).toBe(true);
    expect(text).toMatch(/\]\(https?:\/\/\S+\/search\)/);
    expect(text).toMatch(/\]\(https?:\/\/\S+\/search\?category=photography\)/);
    for (const slug of APPROVED) expect(text).toContain(`/providers/${slug}`);
    expect(text).not.toContain("sevara-aliyeva");
    expect(bannedIn(text)).toEqual([]);
  });
});
