import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { absoluteUrl, siteUrl } from "@/lib/site";
import { searchSchema } from "@/lib/providers";
import { CITIES } from "@/lib/constants";
import { THEME_BROWSER_COLOR } from "@/lib/themePure";
import {
  AI_CRAWLERS,
  breadcrumbJsonLd,
  buildFaq,
  buildLlmsTxt,
  buildRobots,
  creatorJsonLd,
  creatorListJsonLd,
  faqJsonLd,
  HOME_DESCRIPTION,
  HOME_TITLE,
  jsonLdString,
  LLMS_MAX_CREATORS,
  ogDefaults,
  organizationJsonLd,
  PRIVATE_PATHS,
  SEARCH_DESCRIPTION,
  SEARCH_TITLE,
  searchIndexing,
  websiteJsonLd,
  type CreatorSeo,
} from "@/lib/seo";

const BASE = "https://tarmoq.example";
const CATEGORIES = [
  { slug: "mobile-videography", name: "Mobilografiya" },
  { slug: "photography", name: "Fotografiya" },
  { slug: "video-editing", name: "Video montaj" },
  { slug: "drone", name: "Dron bilan suratga olish" },
];

const creator: CreatorSeo = {
  slug: "jasur-karimov",
  name: "Jasur Karimov",
  headline: "Kafe va restoranlar uchun reels va reklama roliklari",
  bio: "Besh yildan beri Andijonda tushiraman.\nIphone va gimbal bilan ishlayman.",
  city: "Andijon",
  category: "Mobilografiya",
  languages: ["Oʻzbek", "Rus"],
  services: [
    { title: "Reels paketi", description: "3 ta vertikal video", price: 450_000 },
    { title: "Reklama roligi", description: null, price: 1_200_000 },
  ],
  ratingAvg: 4.666,
  ratingCount: 3,
  visibleReviews: 3,
};

// ---------- the payment-words guard ----------

// Payments are manual or test mode, and meta tags, JSON-LD, llms.txt and the FAQ cannot carry the "Sinov rejimi" badge.
// So none of them may promise anything about money. Apostrophe look-alikes are removed first, so every spelling matches.
const BANNED = [/tolov/, /оплат/, /платеж/, /escrow/, /pul himoya/, /kafolat/, /himoyalangan/];
const normalise = (s: string) => s.toLowerCase().replace(/[ʻʼ'’‘`]/g, "");
function bannedIn(text: string): string[] {
  const t = normalise(text);
  return BANNED.filter((re) => re.test(t)).map(String);
}
/** Every string anywhere inside a value (keys are not text a reader sees, so only values). */
function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => allStrings(v, out));
  return out;
}

describe("site address", () => {
  const KEYS = ["APP_URL", "RENDER_EXTERNAL_URL"] as const;
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("is APP_URL without a trailing slash", () => {
    process.env.APP_URL = "https://tarmoq-uz.onrender.com/";
    expect(siteUrl()).toBe("https://tarmoq-uz.onrender.com");
  });

  it("falls back to Render's own address, then to localhost", () => {
    process.env.RENDER_EXTERNAL_URL = "https://x.onrender.com";
    expect(siteUrl()).toBe("https://x.onrender.com");
    delete process.env.RENDER_EXTERNAL_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("skips a value that is not an http(s) address", () => {
    process.env.APP_URL = "not a url";
    process.env.RENDER_EXTERNAL_URL = "https://x.onrender.com";
    expect(siteUrl()).toBe("https://x.onrender.com");
    process.env.APP_URL = "javascript:alert(1)";
    expect(siteUrl()).toBe("https://x.onrender.com");
  });

  it("is read on every call, so a change of APP_URL needs no rebuild", () => {
    process.env.APP_URL = "https://one.example";
    expect(siteUrl()).toBe("https://one.example");
    process.env.APP_URL = "https://two.example";
    expect(siteUrl()).toBe("https://two.example");
  });

  it("builds absolute addresses", () => {
    expect(absoluteUrl("/search?category=drone", BASE)).toBe("https://tarmoq.example/search?category=drone");
    expect(absoluteUrl("providers/x", BASE)).toBe("https://tarmoq.example/providers/x");
    expect(absoluteUrl("/", BASE)).toBe("https://tarmoq.example/");
    expect(absoluteUrl("https://other.example/a", BASE)).toBe("https://other.example/a");
  });
});

describe("jsonLdString", () => {
  it("can never close the script tag, and still parses back to the same data", () => {
    const data = { name: "</script><script>alert(1)</script>", note: "a < b" };
    const text = jsonLdString(data);
    expect(text).not.toContain("<");
    expect(text.toLowerCase()).not.toContain("</script");
    expect(JSON.parse(text)).toEqual(data);
  });
});

describe("which search pages are indexed", () => {
  it("indexes /search with no filters, whatever empty fields the form sent", () => {
    expect(searchIndexing({}, false)).toEqual({ canonical: "/search", index: true });
    expect(searchIndexing({ q: "", city: "", category: "" }, false)).toEqual({ canonical: "/search", index: true });
  });

  it("gives a real category its own indexed address", () => {
    expect(searchIndexing({ category: "photography" }, true)).toEqual({ canonical: "/search?category=photography", index: true });
    expect(searchIndexing({ category: "photography", q: "" }, true)).toEqual({ canonical: "/search?category=photography", index: true });
  });

  it("does not index an unknown category", () => {
    expect(searchIndexing({ category: "no-such" }, false)).toEqual({ canonical: "/search", index: false });
  });

  it("does not index any other combination, and points it at /search", () => {
    const off = { canonical: "/search", index: false };
    expect(searchIndexing({ q: "toy" }, false)).toEqual(off);
    expect(searchIndexing({ city: "Andijon" }, false)).toEqual(off);
    expect(searchIndexing({ sort: "price_asc" }, false)).toEqual(off);
    expect(searchIndexing({ page: "2" }, false)).toEqual(off);
    expect(searchIndexing({ category: "photography", city: "Andijon" }, true)).toEqual(off);
    expect(searchIndexing({ category: "photography", page: "2" }, true)).toEqual(off);
    expect(searchIndexing({ utm_source: "x" }, false)).toEqual(off);
    expect(searchIndexing({ category: ["photography", "drone"] }, true)).toEqual(off);
  });
});

describe("robots.txt rules", () => {
  const robots = buildRobots(BASE);
  const rules = robots.rules;

  it("lists the sitemap at the site's address", () => {
    expect(robots.sitemap).toBe("https://tarmoq.example/sitemap.xml");
  });

  it("keeps crawlers out of the API, the cabinets, checkout and the account pages", () => {
    for (const p of ["/api/", "/admin", "/dashboard", "/orders", "/checkout", "/messages", "/settings", "/login", "/register", "/forbidden"]) {
      expect(PRIVATE_PATHS).toContain(p);
    }
    // Everything public stays open: nothing disallows the root or the public pages.
    expect(PRIVATE_PATHS).not.toContain("/");
    for (const p of ["/search", "/providers", "/llms.txt", "/sitemap.xml"]) expect(PRIVATE_PATHS).not.toContain(p);
  });

  it("names the AI crawlers, and gives them the same private paths (a named group replaces the * group)", () => {
    const named = rules.find((r) => Array.isArray(r.userAgent));
    expect(named).toBeDefined();
    for (const bot of ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended"]) {
      expect(AI_CRAWLERS).toContain(bot);
      expect(named!.userAgent).toContain(bot);
    }
    expect(AI_CRAWLERS).not.toContain("CCBot");
    expect(named!.allow).toBe("/");
    expect(named!.disallow).toEqual(PRIVATE_PATHS);
    const everyone = rules.find((r) => r.userAgent === "*");
    expect(everyone!.allow).toBe("/");
    expect(everyone!.disallow).toEqual(PRIVATE_PATHS);
  });
});

describe("noindex response headers (next.config.mjs)", () => {
  type Rule = { source: string; headers: { key: string; value: string }[] };
  async function rules(): Promise<Rule[]> {
    // A variable path keeps TypeScript from trying to type a .mjs file.
    const mod = await import(/* @vite-ignore */ pathToFileURL(resolve(process.cwd(), "next.config.mjs")).href);
    return mod.default.headers();
  }

  it("marks the API and every private or account prefix noindex, nofollow", async () => {
    const all = await rules();
    for (const p of PRIVATE_PATHS) {
      const prefix = p.replace(/\/$/, "");
      const rule = all.find((r) => r.source === `${prefix}/:path*`);
      expect(rule, prefix).toBeDefined();
      expect(rule!.headers).toEqual([{ key: "X-Robots-Tag", value: "noindex, nofollow" }]);
    }
  });

  it("does not put noindex on the public pages", async () => {
    const all = await rules();
    const noindexed = all.filter((r) => r.headers.some((h) => h.key === "X-Robots-Tag")).map((r) => r.source);
    for (const s of noindexed) {
      expect(s.startsWith("/search") || s.startsWith("/providers") || s === "/:path*" || s === "/").toBe(false);
    }
  });

  it("leaves the security headers and the receipt policy as they were", async () => {
    const all = await rules();
    const site = all.find((r) => r.source === "/:path*")!;
    expect(site.headers.map((h) => h.key)).toEqual([
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Content-Security-Policy",
    ]);
    const receipt = all.find((r) => r.source === "/api/admin/payments/:id/receipt")!;
    expect(receipt.headers).toHaveLength(1);
    expect(receipt.headers[0]!.key).toBe("Content-Security-Policy");
    expect(receipt.headers[0]!.value).toContain("sandbox");
  });
});

describe("JSON-LD builders", () => {
  it("describes the organisation and the website, with a search box that uses the real q parameter", () => {
    const org = organizationJsonLd(BASE);
    expect(org["@context"]).toBe("https://schema.org");
    expect(org["@type"]).toBe("Organization");
    expect(org.name).toBe("Tarmoq.uz");
    expect(org.url).toBe("https://tarmoq.example/");
    expect(org.logo).toBe("https://tarmoq.example/icon.svg");

    const site = websiteJsonLd(BASE);
    expect(site["@type"]).toBe("WebSite");
    expect(site.potentialAction["@type"]).toBe("SearchAction");
    const template = site.potentialAction.target.urlTemplate;
    expect(template).toBe("https://tarmoq.example/search?q={search_term_string}");
    expect(site.potentialAction["query-input"]).toBe("required name=search_term_string");
    // The parameter in the template is one the search page really reads.
    const param = new URL(template.replace("{search_term_string}", "x")).searchParams;
    expect([...param.keys()].every((k) => k in searchSchema.shape)).toBe(true);
  });

  it("numbers the breadcrumb and makes every address absolute", () => {
    const b = breadcrumbJsonLd(
      [{ name: "Bosh sahifa", path: "/" }, { name: "Ijodkorlarni toping", path: "/search" }, { name: "Jasur Karimov", path: "/providers/jasur-karimov" }],
      BASE,
    );
    expect(b["@type"]).toBe("BreadcrumbList");
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(b.itemListElement.every((i) => i["@type"] === "ListItem" && i.item.startsWith("https://tarmoq.example/"))).toBe(true);
  });

  it("lists the creators shown on a search page", () => {
    const list = creatorListJsonLd([{ slug: "a", name: "A" }, { slug: "b", name: "B" }], BASE);
    expect(list["@type"]).toBe("ItemList");
    expect(list.numberOfItems).toBe(2);
    expect(list.itemListElement[1]).toEqual({ "@type": "ListItem", position: 2, name: "B", url: "https://tarmoq.example/providers/b" });
  });

  it("builds a creator page: profile page, person, service with one offer per package", () => {
    const ld = creatorJsonLd(creator, BASE);
    expect(ld["@context"]).toBe("https://schema.org");
    const [page, person, service] = ld["@graph"] as Record<string, any>[];
    expect(page["@type"]).toBe("ProfilePage");
    expect(page.url).toBe("https://tarmoq.example/providers/jasur-karimov");
    expect(page.mainEntity).toEqual({ "@id": person["@id"] });
    expect(person["@type"]).toBe("Person");
    expect(person.name).toBe("Jasur Karimov");
    expect(person.description).toBe(creator.headline);
    expect(person.address).toMatchObject({ "@type": "PostalAddress", addressLocality: "Andijon" });
    expect(person.knowsLanguage).toEqual(["Oʻzbek", "Rus"]);
    expect(service["@type"]).toBe("Service");
    expect(service.provider).toEqual({ "@id": person["@id"] });
    expect(service.offers).toHaveLength(2);
    for (const offer of service.offers) {
      expect(offer["@type"]).toBe("Offer");
      expect(offer.priceCurrency).toBe("UZS");
      expect(typeof offer.price).toBe("number");
    }
    expect(service.offers[0].price).toBe(450_000);
    expect(service.offers[0].description).toBe("3 ta vertikal video");
    expect("description" in service.offers[1]).toBe(false); // an empty description is left out, not sent as null
  });

  it("includes the rating only when real reviews are shown", () => {
    const rating = (c: CreatorSeo) => (creatorJsonLd(c, BASE)["@graph"][2] as Record<string, any>).aggregateRating;
    expect(rating(creator)).toEqual({ "@type": "AggregateRating", ratingValue: 4.7, reviewCount: 3, bestRating: 5, worstRating: 1 });
    expect(rating({ ...creator, ratingCount: 0, ratingAvg: 0, visibleReviews: 0 })).toBeUndefined();
    expect(rating({ ...creator, visibleReviews: 0 })).toBeUndefined(); // a count with no visible review is not shown
    expect(rating({ ...creator, ratingCount: 0, visibleReviews: 2 })).toBeUndefined();
    expect(rating({ ...creator, ratingAvg: 0 })).toBeUndefined();
  });

  it("adds a picture only when the creator has a real one, and offers only when there are packages", () => {
    const personOf = (c: CreatorSeo) => creatorJsonLd(c, BASE)["@graph"][1] as Record<string, any>;
    expect("image" in personOf(creator)).toBe(false);
    expect(personOf({ ...creator, image: "https://img.example/jasur.jpg" }).image).toBe("https://img.example/jasur.jpg");
    expect("knowsLanguage" in personOf({ ...creator, languages: [] })).toBe(false);
    const service = creatorJsonLd({ ...creator, services: [] }, BASE)["@graph"][2] as Record<string, any>;
    expect("offers" in service).toBe(false);
  });

  it("falls back to the headline when a creator has no bio", () => {
    const service = creatorJsonLd({ ...creator, bio: "  " }, BASE)["@graph"][2] as Record<string, any>;
    expect(service.description).toBe(creator.headline);
  });
});

describe("home page FAQ", () => {
  const faq = buildFaq(CATEGORIES.map((c) => c.name), CITIES);

  it("has three to five questions, each with an answer", () => {
    expect(faq.length).toBeGreaterThanOrEqual(3);
    expect(faq.length).toBeLessThanOrEqual(5);
    for (const f of faq) {
      expect(f.question.trim().endsWith("?")).toBe(true);
      expect(f.answer.trim().length).toBeGreaterThan(40);
    }
    expect(new Set(faq.map((f) => f.question)).size).toBe(faq.length);
  });

  it("names the real categories and cities", () => {
    const text = faq.map((f) => f.answer).join(" ");
    for (const c of CATEGORIES) expect(text).toContain(c.name);
    for (const city of CITIES) expect(text).toContain(city);
  });

  it("turns into FAQPage data that carries exactly the same words", () => {
    const ld = faqJsonLd(faq);
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toHaveLength(faq.length);
    ld.mainEntity.forEach((q, i) => {
      expect(q["@type"]).toBe("Question");
      expect(q.name).toBe(faq[i]!.question);
      expect(q.acceptedAnswer).toEqual({ "@type": "Answer", text: faq[i]!.answer });
    });
  });

  it("still reads sensibly before any category exists", () => {
    const empty = buildFaq([], CITIES);
    expect(empty[2]!.answer).not.toContain("Yoʻnalishlar");
  });
});

describe("llms.txt", () => {
  const creators = [
    { slug: "jasur-karimov", name: "Jasur Karimov", headline: "Reels va reklama", city: "Andijon" },
    { slug: "madina", name: "Madina [Yusupova]\nIkkinchi qator", headline: "Foto\n\nsessiya", city: "Toshkent" },
  ];
  const text = buildLlmsTxt({ categories: CATEGORIES, creators, cities: CITIES }, BASE);

  it("starts with the site name and a one-paragraph summary, as the format asks", () => {
    const lines = text.split("\n");
    expect(lines[0]).toBe("# Tarmoq.uz");
    expect(lines[2]!.startsWith("> ")).toBe(true);
    expect(text.endsWith("\n")).toBe(true);
  });

  it("links the home page, the search, the sitemap, each category and each creator with absolute addresses", () => {
    expect(text).toContain("(https://tarmoq.example/)");
    expect(text).toContain("(https://tarmoq.example/search)");
    expect(text).toContain("(https://tarmoq.example/sitemap.xml)");
    for (const c of CATEGORIES) expect(text).toContain(`(https://tarmoq.example/search?category=${c.slug})`);
    expect(text).toContain("[Jasur Karimov](https://tarmoq.example/providers/jasur-karimov): Reels va reklama (Andijon)");
  });

  it("keeps a creator's name and headline on one line and out of the link syntax", () => {
    expect(text).toContain("[Madina Yusupova Ikkinchi qator](https://tarmoq.example/providers/madina): Foto sessiya (Toshkent)");
  });

  it("caps the creator list and points to the search for the rest", () => {
    const many = Array.from({ length: LLMS_MAX_CREATORS + 5 }, (_, i) => ({ slug: `c${i}`, name: `C${i}`, headline: "h", city: "Andijon" }));
    const out = buildLlmsTxt({ categories: [], creators: many, cities: CITIES }, BASE);
    expect(out.match(/\/providers\//g)).toHaveLength(LLMS_MAX_CREATORS);
    expect(out).toContain("More creators: https://tarmoq.example/search");
  });
});

describe("the sitemap and the llms.txt route (database mocked)", () => {
  const findCategories = vi.fn();
  const findProfiles = vi.fn();
  beforeEach(() => {
    vi.resetModules();
    findCategories.mockReset().mockResolvedValue([{ slug: "photography", name: "Fotografiya" }, { slug: "drone", name: "Dron" }]);
    findProfiles.mockReset();
    vi.doMock("@/lib/db", () => ({ prisma: { category: { findMany: findCategories }, providerProfile: { findMany: findProfiles } } }));
    process.env.APP_URL = BASE;
  });
  afterEach(() => {
    vi.doUnmock("@/lib/db");
    delete process.env.APP_URL;
  });

  it("lists the home page, /search, every category and every approved creator, newest first, in one capped query", async () => {
    const newer = new Date("2026-11-10T00:00:00Z");
    const older = new Date("2026-10-01T00:00:00Z");
    findProfiles.mockResolvedValue([{ slug: "jasur-karimov", updatedAt: newer }, { slug: "bobur-tursunov", updatedAt: older }]);
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    expect(entries.map((e) => e.url)).toEqual([
      "https://tarmoq.example/",
      "https://tarmoq.example/search",
      "https://tarmoq.example/search?category=photography",
      "https://tarmoq.example/search?category=drone",
      "https://tarmoq.example/providers/jasur-karimov",
      "https://tarmoq.example/providers/bobur-tursunov",
    ]);
    expect(entries.find((e) => e.url.endsWith("jasur-karimov"))!.lastModified).toEqual(newer);
    expect(entries[0]!.lastModified).toEqual(newer);

    // Only approved profiles of active accounts, ordered, capped, and a single query for them.
    expect(findProfiles).toHaveBeenCalledTimes(1);
    const args = findProfiles.mock.calls[0]![0];
    expect(args.where).toEqual({ status: "APPROVED", user: { isActive: true } });
    expect(args.take).toBe(5000);
    expect(args.select).toEqual({ slug: true, updatedAt: true });
  });

  it("is still valid with no creators at all", async () => {
    findProfiles.mockResolvedValue([]);
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    expect(entries.map((e) => e.url).slice(0, 2)).toEqual(["https://tarmoq.example/", "https://tarmoq.example/search"]);
    expect(entries[0]!.lastModified).toBeUndefined();
  });

  it("is built on each request, never at build time", async () => {
    const mod = await import("@/app/sitemap");
    expect(mod.dynamic).toBe("force-dynamic");
    const llms = await import("@/app/llms.txt/route");
    expect(llms.dynamic).toBe("force-dynamic");
    const robots = await import("@/app/robots");
    expect(robots.dynamic).toBe("force-dynamic");
  });

  it("serves llms.txt as text that is cached for an hour, from approved creators only", async () => {
    findProfiles.mockResolvedValue([{ slug: "jasur-karimov", headline: "Reels", city: "Andijon", user: { name: "Jasur Karimov" } }]);
    const { GET } = await import("@/app/llms.txt/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/(markdown|plain)/);
    expect(res.headers.get("cache-control")).toContain("max-age=3600");
    const body = await res.text();
    expect(body).toContain("https://tarmoq.example/providers/jasur-karimov");
    expect(findProfiles.mock.calls[0]![0].where).toEqual({ status: "APPROVED", user: { isActive: true } });
  });
});

describe("manifest", () => {
  it("installs from the home page with the dark theme colours of the site", async () => {
    const { default: manifest } = await import("@/app/manifest");
    const m = manifest();
    expect(m.name).toBe("Tarmoq.uz");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.icons?.[0]).toMatchObject({ src: "/icon.svg", type: "image/svg+xml" });
    // The colours are copies of --c-paper in globals.css (a manifest cannot read CSS variables): they must not drift.
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const [r, g, b] = /--c-paper:\s*(\d+) (\d+) (\d+);/.exec(css)!.slice(1).map(Number) as [number, number, number];
    const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    expect(m.background_color).toBe(hex);
    expect(m.theme_color).toBe(hex);
    // The browser bar colour (layout.tsx, generateViewport) comes from the same table; the light scheme's is checked in themeContrast.test.ts.
    expect(THEME_BROWSER_COLOR.dark).toBe(hex);
    expect(readFileSync(resolve(process.cwd(), "src/app/layout.tsx"), "utf8")).toContain("THEME_BROWSER_COLOR[await getTheme()]");
  });
});

describe("no payment promise anywhere search engines and AI crawlers read", () => {
  it("the guard catches what it is meant to catch", () => {
    for (const bad of ["Toʻlov himoyada", "to'lov", "TOLOV", "Xavfsiz toʻlov", "Оплата онлайн", "Платежи", "escrow", "Pul himoyada", "Kafolat beramiz", "Himoyalangan buyurtma"]) {
      expect(bannedIn(bad).length, bad).toBeGreaterThan(0);
    }
    // And it leaves ordinary words alone.
    for (const fine of ["toʻldiring", "Narxlarini solishtiring", "paketlaringizni qoʻshing", "UZS", "price"]) expect(bannedIn(fine), fine).toEqual([]);
  });

  it("holds for the titles, descriptions, JSON-LD, robots, FAQ, llms.txt, manifest and the layout's metadata", async () => {
    const faq = buildFaq(CATEGORIES.map((c) => c.name), CITIES);
    const { default: manifest } = await import("@/app/manifest");
    const layout = readFileSync(resolve(process.cwd(), "src/app/layout.tsx"), "utf8");
    const layoutMetadata = layout.slice(layout.indexOf("export async function generateMetadata"), layout.indexOf("// The browser bar colour"));
    expect(layoutMetadata.length).toBeGreaterThan(100);

    const texts: Record<string, string[]> = {
      titles: [HOME_TITLE, HOME_DESCRIPTION, SEARCH_TITLE, SEARCH_DESCRIPTION],
      openGraph: allStrings(ogDefaults()),
      organization: allStrings(organizationJsonLd(BASE)),
      website: allStrings(websiteJsonLd(BASE)),
      breadcrumb: allStrings(breadcrumbJsonLd([{ name: "Bosh sahifa", path: "/" }, { name: "Ijodkorlarni toping", path: "/search" }], BASE)),
      list: allStrings(creatorListJsonLd([{ slug: "a", name: "A" }], BASE)),
      creator: allStrings(creatorJsonLd(creator, BASE)),
      faq: allStrings(faq),
      faqJsonLd: allStrings(faqJsonLd(faq)),
      robots: allStrings(buildRobots(BASE)),
      llms: [buildLlmsTxt({ categories: CATEGORIES, creators: [{ slug: "a", name: "A", headline: "h", city: "Andijon" }], cities: CITIES }, BASE)],
      manifest: allStrings(manifest()),
      layoutMetadata: [layoutMetadata],
    };
    for (const [where, strings] of Object.entries(texts)) {
      expect(strings.length, where).toBeGreaterThan(0);
      for (const s of strings) expect(bannedIn(s), `${where}: ${s.slice(0, 80)}`).toEqual([]);
    }
  });
});
