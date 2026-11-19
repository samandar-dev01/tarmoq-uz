import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "@/i18n/dictionary";
import { CITIES } from "@/lib/constants";
import {
  breadcrumbJsonLd,
  buildFaq,
  creatorJsonLd,
  creatorListJsonLd,
  faqJsonLd,
  HOME_DESCRIPTION,
  HOME_TITLE,
  homeDescription,
  homeTitle,
  ogDefaults,
  organizationJsonLd,
  pageAlternates,
  SEARCH_DESCRIPTION,
  SEARCH_TITLE,
  searchMeta,
  websiteJsonLd,
  type CreatorSeo,
} from "@/lib/seo";

// The SEO builders in two languages: Uzbek exactly as before, Russian with its own words, its own `/ru/...` addresses and
// the hreflang pair. (The Russian words are also scanned for payment promises in seo.test.ts.)

const BASE = "https://tarmoq.example";
const CYRILLIC = /[А-Яа-яЁё]/;
const UZ_APOSTROPHE = /[ʻʼ]/;

const creator: CreatorSeo = {
  slug: "jasur-karimov",
  name: "Jasur Karimov",
  headline: "Kafe va restoranlar uchun reels va reklama roliklari",
  bio: "Besh yildan beri Andijonda tushiraman.",
  city: "Andijon",
  category: "Mobilografiya",
  languages: ["Oʻzbek", "Rus"],
  services: [{ title: "Reels paketi", description: "3 ta vertikal video", price: 450_000 }],
  ratingAvg: 4.5,
  ratingCount: 2,
  visibleReviews: 2,
};

/** Every string anywhere inside a value. */
function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => allStrings(v, out));
  return out;
}

describe("titles and descriptions", () => {
  it("are the Uzbek text itself in Uzbek, and are never left out", () => {
    expect(homeTitle("uz")).toBe(HOME_TITLE);
    expect(homeTitle()).toBe(HOME_TITLE);
    expect(homeDescription("uz")).toBe(HOME_DESCRIPTION);
    expect(searchMeta("uz", null)).toEqual({ title: SEARCH_TITLE, heading: null, description: SEARCH_DESCRIPTION });
    expect(searchMeta("uz", { category: "Fotografiya", city: null, count: 2, fromPrice: null })).toEqual({
      title: "Fotografiya: ijodkorlarni toping",
      heading: "Fotografiya: ijodkorlarni toping",
      description: "Oʻzbekistondagi fotografiya yoʻnalishidagi ijodkorlar: 2 ta ijodkor. Shahar va narx boʻyicha saralang.",
    });
  });

  it("are Russian in Russian: Cyrillic, no Uzbek apostrophe letters, and not the Uzbek text", () => {
    const photo = { category: "Фотография", city: null, count: 2, fromPrice: null };
    const ru = [homeTitle("ru"), homeDescription("ru"), ...Object.values(searchMeta("ru", null)), ...Object.values(searchMeta("ru", photo))].filter((v): v is string => v !== null);
    for (const s of ru) {
      expect(s).toMatch(CYRILLIC);
      expect(s).not.toMatch(UZ_APOSTROPHE);
    }
    expect(homeTitle("ru")).toBe("Tarmoq.uz: видеографы, фотографы и монтажёры Узбекистана");
    expect(searchMeta("ru", photo)).toEqual({
      title: "Фотография: найдите креаторов",
      heading: "Фотография: найдите креаторов",
      description: "Креаторы Узбекистана в направлении «фотография»: 2 креатора. Фильтры по городу и цене.",
    });
  });
});

describe("Open Graph", () => {
  it("names the language of the page", () => {
    expect(ogDefaults().locale).toBe("uz_UZ");
    expect(ogDefaults("uz").locale).toBe("uz_UZ");
    expect(ogDefaults("ru").locale).toBe("ru_RU");
    expect(ogDefaults("ru").siteName).toBe("Tarmoq.uz");
    expect(ogDefaults("ru").images).toEqual(ogDefaults("uz").images);
  });
});

describe("canonical address and hreflang (pageAlternates)", () => {
  it("while Russian is off: the page's own address and nothing else, exactly as before", () => {
    expect(pageAlternates("uz", "/", false)).toEqual({ canonical: "/" });
    expect(pageAlternates("uz", "/search?category=drone", false)).toEqual({ canonical: "/search?category=drone" });
    expect("languages" in pageAlternates("uz", "/providers/x", false)).toBe(false);
  });

  it("while Russian is on: self-canonical in each language, and the same pair of addresses on both", () => {
    const pair = (path: string, ru: string) => ({ uz: path, ru, "x-default": path });
    expect(pageAlternates("uz", "/", true)).toEqual({ canonical: "/", languages: pair("/", "/ru") });
    expect(pageAlternates("ru", "/", true)).toEqual({ canonical: "/ru", languages: pair("/", "/ru") });
    expect(pageAlternates("ru", "/search", true)).toEqual({ canonical: "/ru/search", languages: pair("/search", "/ru/search") });
    expect(pageAlternates("ru", "/search?category=drone", true)).toEqual({
      canonical: "/ru/search?category=drone",
      languages: pair("/search?category=drone", "/ru/search?category=drone"),
    });
    expect(pageAlternates("ru", "/providers/jasur-karimov", true)).toEqual({
      canonical: "/ru/providers/jasur-karimov",
      languages: pair("/providers/jasur-karimov", "/ru/providers/jasur-karimov"),
    });
    // x-default is the Uzbek address, for every page.
    expect(pageAlternates("ru", "/search", true).languages!["x-default"]).toBe("/search");
  });

  it("reads the real switch when `live` is left out: off here, on with RUSSIAN_LIVE=1", () => {
    vi.stubEnv("RUSSIAN_LIVE", "");
    expect(pageAlternates("uz", "/search")).toEqual({ canonical: "/search" });
    vi.stubEnv("RUSSIAN_LIVE", "1");
    expect(pageAlternates("uz", "/search").languages).toBeDefined();
    vi.unstubAllEnvs();
  });
});

describe("JSON-LD in Uzbek is what it was", () => {
  it("has no language marks the old output did not have", () => {
    const org = organizationJsonLd(BASE);
    expect(org.url).toBe("https://tarmoq.example/");
    expect(org.description).toBe(HOME_DESCRIPTION);
    const site = websiteJsonLd(BASE);
    expect(site["@id"]).toBe("https://tarmoq.example/#website");
    expect(site.url).toBe("https://tarmoq.example/");
    expect(site.inLanguage).toBe("uz");
    expect(site.potentialAction.target.urlTemplate).toBe("https://tarmoq.example/search?q={search_term_string}");
    expect(faqJsonLd(buildFaq(["Fotografiya"], CITIES))).not.toHaveProperty("inLanguage");
    expect(faqJsonLd(buildFaq(["Fotografiya"], CITIES), "uz")).not.toHaveProperty("inLanguage");
    const [page] = creatorJsonLd(creator, BASE)["@graph"] as Record<string, any>[];
    expect(page.url).toBe("https://tarmoq.example/providers/jasur-karimov");
    expect(page.inLanguage).toBe("uz");
    expect(page.isPartOf).toEqual({ "@id": "https://tarmoq.example/#website" });
  });
});

describe("JSON-LD in Russian", () => {
  it("the organisation and the website: Russian text, the /ru home page and search, a site node of their own", () => {
    const org = organizationJsonLd(BASE, "ru");
    expect(org["@id"]).toBe("https://tarmoq.example/#organization"); // the organisation is one, whatever the language
    expect(org.url).toBe("https://tarmoq.example/ru");
    expect(org.description).toBe(homeDescription("ru"));
    expect(org.description).toMatch(CYRILLIC);

    const site = websiteJsonLd(BASE, "ru");
    expect(site["@id"]).toBe("https://tarmoq.example/ru#website");
    expect(site["@id"]).not.toBe(websiteJsonLd(BASE)["@id"]);
    expect(site.url).toBe("https://tarmoq.example/ru");
    expect(site.inLanguage).toBe("ru");
    expect(site.publisher).toEqual({ "@id": "https://tarmoq.example/#organization" });
    expect(site.potentialAction.target.urlTemplate).toBe("https://tarmoq.example/ru/search?q={search_term_string}");
  });

  it("the breadcrumb and the creator list point at /ru addresses", () => {
    const b = breadcrumbJsonLd(
      [{ name: "Главная", path: "/" }, { name: "Найдите креаторов", path: "/search" }, { name: "Мобильная съёмка", path: "/search?category=mobile-videography" }, { name: "Jasur Karimov", path: "/providers/jasur-karimov" }],
      BASE,
      "ru",
    );
    expect(b.itemListElement.map((i) => i.item)).toEqual([
      "https://tarmoq.example/ru",
      "https://tarmoq.example/ru/search",
      "https://tarmoq.example/ru/search?category=mobile-videography",
      "https://tarmoq.example/ru/providers/jasur-karimov",
    ]);
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2, 3, 4]);
    const list = creatorListJsonLd([{ slug: "a", name: "A" }, { slug: "b", name: "B" }], BASE, "ru");
    expect(list.itemListElement.map((i) => i.url)).toEqual(["https://tarmoq.example/ru/providers/a", "https://tarmoq.example/ru/providers/b"]);
  });

  it("the creator page: this language's address and ids, Russian labels from the caller, the creator's own words as written", () => {
    const ru = { ...creator, city: "Андижан", category: "Мобильная съёмка", languages: ["Узбекский", "Русский"] };
    const [page, person, service] = creatorJsonLd(ru, BASE, "ru")["@graph"] as Record<string, any>[];
    expect(page.url).toBe("https://tarmoq.example/ru/providers/jasur-karimov");
    expect(page["@id"]).toBe(page.url);
    expect(page.inLanguage).toBe("ru");
    expect(page.isPartOf).toEqual({ "@id": "https://tarmoq.example/ru#website" });
    expect(person["@id"]).toBe("https://tarmoq.example/ru/providers/jasur-karimov#person");
    expect(person.address.addressLocality).toBe("Андижан");
    expect(person.jobTitle).toBe("Мобильная съёмка");
    expect(person.knowsLanguage).toEqual(["Узбекский", "Русский"]);
    expect(person.name).toBe("Jasur Karimov");
    expect(person.description).toBe(creator.headline); // not translated: the creator wrote it
    expect(service.description).toBe(creator.bio);
    expect(service.url).toBe(page.url);
    expect(service.offers[0]).toMatchObject({ name: "Reels paketi", description: "3 ta vertikal video", price: 450_000, priceCurrency: "UZS", url: page.url });
    expect(service.aggregateRating).toMatchObject({ ratingValue: 4.5, reviewCount: 2 });
  });

  it("the FAQ: Russian questions and answers, cities and categories in Russian, FAQPage data with inLanguage ru and the very same words", () => {
    const faq = buildFaq(["Мобильная съёмка", "Фотография"], CITIES, "ru");
    expect(faq).toHaveLength(4);
    expect(faq.map((f) => f.question)).toEqual([
      "Как найти креатора?",
      "Как проходит заказ от задания до готового видео?",
      "Какие направления и города есть?",
      "Как стать креатором?",
    ]);
    const where = faq[2]!.answer;
    expect(where).toContain("Направления: Мобильная съёмка, Фотография.");
    for (const city of ["Андижан", "Ташкент", "Самарканд", "Бухара", "Наманган", "Фергана", "Коканд", "Нукус", "Карши", "Термез"]) expect(where).toContain(city);
    for (const f of faq) {
      expect(f.question).toMatch(CYRILLIC);
      expect(f.answer).toMatch(CYRILLIC);
      expect(f.question + f.answer).not.toMatch(UZ_APOSTROPHE);
      expect(f.question.trim().endsWith("?")).toBe(true);
    }
    const ld = faqJsonLd(faq, "ru");
    expect(ld.inLanguage).toBe("ru");
    expect(ld.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(faq.map((f) => [f.question, f.answer]));
    expect(buildFaq([], CITIES, "ru")[2]!.answer).not.toContain("Направления");
  });

  it("no Uzbek apostrophe letter anywhere in the Russian structured data, apart from what the creator wrote", () => {
    const ru = { ...creator, city: "Андижан", category: "Мобильная съёмка", languages: ["Узбекский"], bio: null, headline: "Reels", services: [{ title: "Reels", description: null, price: 1 }] };
    const strings = [
      ...allStrings(organizationJsonLd(BASE, "ru")),
      ...allStrings(websiteJsonLd(BASE, "ru")),
      ...allStrings(faqJsonLd(buildFaq(["Фотография"], CITIES, "ru"), "ru")),
      ...allStrings(creatorJsonLd(ru, BASE, "ru")),
    ];
    for (const s of strings) expect(s, s.slice(0, 60)).not.toMatch(UZ_APOSTROPHE);
  });

  it("every Russian text this file relies on really is in the dictionary (a missing entry would fall back to Uzbek)", () => {
    for (const key of [HOME_TITLE, HOME_DESCRIPTION, SEARCH_TITLE, SEARCH_DESCRIPTION]) expect(translate("ru", key)).not.toBe(key);
  });
});

describe("the sitemap with Russian on and off (database mocked)", () => {
  const BASE_URL = "https://tarmoq.example";
  const findCategories = vi.fn();
  const findProfiles = vi.fn();
  const groupProfiles = vi.fn();
  // One creator, in photography in Andijon: that gives the category's page, the city's page and the two together.
  const PATHS = ["/", "/search", "/search?category=photography", "/search?city=Andijon", "/search?category=photography&city=Andijon", "/providers/jasur-karimov"];
  beforeEach(() => {
    vi.resetModules();
    findCategories.mockReset().mockResolvedValue([{ id: "c1", slug: "photography" }]);
    findProfiles.mockReset().mockResolvedValue([{ slug: "jasur-karimov", updatedAt: new Date("2026-11-10T00:00:00Z") }]);
    groupProfiles.mockReset().mockResolvedValue([{ city: "Andijon", categoryId: "c1", _count: { _all: 1 } }]);
    vi.doMock("@/lib/db", () => ({ prisma: { category: { findMany: findCategories }, providerProfile: { findMany: findProfiles, groupBy: groupProfiles } } }));
    // The data cache needs Next's runtime, which a unit test does not have: stand in with a pass-through, so what is tested
    // is still this file's own output (src/lib/publicCache.ts is only a thin wrapper around the same queries).
    vi.doMock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }));
    process.env.APP_URL = BASE_URL;
  });
  afterEach(() => {
    vi.doUnmock("@/lib/db");
    vi.doUnmock("next/cache");
    vi.unstubAllEnvs();
    delete process.env.APP_URL;
  });

  it("Russian off: the Uzbek list only, no alternates anywhere", async () => {
    vi.stubEnv("RUSSIAN_LIVE", "");
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    expect(entries.map((e) => e.url)).toEqual(PATHS.map((p) => BASE_URL + p));
    expect(entries.every((e) => e.alternates === undefined)).toBe(true);
    expect(entries.some((e) => e.url.includes("/ru"))).toBe(false);
  });

  it("Russian on: every public page again at its /ru address, and every entry names both languages and x-default", async () => {
    vi.stubEnv("RUSSIAN_LIVE", "1");
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    const toRu = (p: string) => (p === "/" ? "/ru" : `/ru${p}`);
    const n = PATHS.length;
    expect(urls).toEqual([...PATHS.map((p) => BASE_URL + p), ...PATHS.map((p) => BASE_URL + toRu(p))]);
    PATHS.forEach((uz, i) => {
      const ru = toRu(uz);
      const languages = { uz: BASE_URL + uz, ru: BASE_URL + ru, "x-default": BASE_URL + uz };
      expect(entries[i]!.alternates, uz).toEqual({ languages });
      expect(entries[i + n]!.alternates, ru).toEqual({ languages });
    });
    // The Russian entries keep the dates and priorities of the Uzbek ones.
    expect(entries[n]!.lastModified).toEqual(entries[0]!.lastModified);
    expect(entries[2 * n - 1]!.priority).toBe(entries[n - 1]!.priority);
    // Nothing private, ever.
    expect(urls.some((u) => /\/(login|register|orders|dashboard|admin|messages|checkout|api)\b/.test(u))).toBe(false);
  });
});
