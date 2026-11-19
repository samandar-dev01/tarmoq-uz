// Pure builders for everything a search engine or an AI crawler reads: metadata pieces, JSON-LD, robots rules,
// llms.txt and the home page FAQ. No database and no request here, so every string they produce is unit-tested.
//
// HARD RULE: no payment promise in any of it, in Russian too. Payments run in manual or test mode and none of these
// places can carry the "Sinov rejimi" badge. A creator's real package price is a fact from the database and may be listed.
// tests/unit/seo.test.ts guards the wording (Uzbek and Russian).
//
// LANGUAGES. Every builder that writes words takes the page's `locale` (last parameter, "uz" when left out, so the Uzbek
// output is exactly what it was). The Russian text is in src/i18n/ru/public.ts; the addresses of a Russian page are
// `/ru/...` (localHref). Whether a Russian page exists at all is decided by the caller: `getLocale()` is "uz" while
// Russian is off, and `pageAlternates` / `hreflang` return no alternates then.
import { DEFAULT_LOCALE, OG_LOCALE, russianLive, type Locale } from "../i18n/config";
import { tk, translate } from "../i18n/dictionary";
import { hreflang, localHref } from "../i18n/paths";
import { plural } from "../i18n/plural";
import { CITIES, labelFor } from "./constants";
import { formatPriceFrom } from "./publicFormat";
import { absoluteUrl, SITE_NAME, siteUrl } from "./site";

/** The share picture (app/opengraph-image.tsx), as a path: Next makes it absolute with the layout's metadataBase. */
export const OG_IMAGE_PATH = "/opengraph-image";

/** A page that sets its own Open Graph block replaces the layout's whole block, so the shared part lives here. */
export function ogDefaults(locale: Locale = DEFAULT_LOCALE) {
  return {
    siteName: SITE_NAME,
    locale: OG_LOCALE[locale],
    type: "website" as const,
    images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: SITE_NAME }],
  };
}

// The Uzbek texts (they are the translation keys); `homeTitle(locale)` and the others give the reader's language.
export const HOME_TITLE = tk("Tarmoq.uz: Oʻzbekistondagi videograf, fotograf va montajchilar");
export const HOME_DESCRIPTION = tk(
  "Oʻzbekiston shaharlaridagi mobilograf, videograf, fotograf va montajchilarni bir joydan toping: paketlari, portfoliosi va mijozlar sharhlarini solishtiring.",
);
export const SEARCH_TITLE = tk("Ijodkorlarni toping");
export const SEARCH_DESCRIPTION = tk("Oʻzbekistondagi videograf, fotograf va montajchilar roʻyxati. Shahar, yoʻnalish va narx boʻyicha saralang.");

export const homeTitle = (locale: Locale = DEFAULT_LOCALE) => translate(locale, HOME_TITLE);
export const homeDescription = (locale: Locale = DEFAULT_LOCALE) => translate(locale, HOME_DESCRIPTION);

/** A landing view of /search: the creators of one category, one city, or one category in one city (see searchIndexing). */
export type Landing = {
  /** The display name of the category (reader's language), or null when the view is not cut by category. */
  category: string | null;
  /** The stored (Uzbek) city, or null when the view is not cut by city. */
  city: string | null;
  /** How many approved creators the view lists. Always at least one: an empty view is not a landing. */
  count: number;
  /** The lowest starting price among them, when any of them states one. */
  fromPrice: number | null;
};

/**
 * The title, the page's own heading and the description of /search. With no `landing` it is the plain search page and
 * `heading` is null (the page keeps its usual heading and sentence). A landing view gets words of its own, and the numbers
 * in them (how many creators, from what price) are read from the database, never made up.
 */
export function searchMeta(locale: Locale, landing: Landing | null): { title: string; heading: string | null; description: string } {
  if (landing === null) return { title: translate(locale, SEARCH_TITLE), heading: null, description: translate(locale, SEARCH_DESCRIPTION) };
  const city = landing.city === null ? null : labelFor(locale, landing.city);
  const facts = [
    plural(locale, landing.count, "ijodkor", ["креатор", "креатора", "креаторов"]),
    ...(landing.fromPrice ? [translate(locale, tk("narxi {price}"), { price: formatPriceFrom(landing.fromPrice, locale) })] : []),
  ].join(", ");
  if (landing.category !== null && city !== null) {
    const category = landing.category;
    return {
      title: translate(locale, tk("{category}, {city}: ijodkorlarni toping"), { category, city }),
      heading: translate(locale, tk("{category}: {city}dagi ijodkorlar"), { category, city }),
      description: translate(locale, tk("{city}dagi {category} yoʻnalishidagi ijodkorlar: {facts}. Paketlari, portfoliosi va mijozlar sharhlarini solishtiring."), { category: category.toLowerCase(), city, facts }),
    };
  }
  if (landing.category !== null) {
    const category = landing.category;
    const title = translate(locale, tk("{category}: ijodkorlarni toping"), { category });
    return {
      title,
      heading: title,
      description: translate(locale, tk("Oʻzbekistondagi {category} yoʻnalishidagi ijodkorlar: {facts}. Shahar va narx boʻyicha saralang."), { category: category.toLowerCase(), facts }),
    };
  }
  return {
    title: translate(locale, tk("{city}: videograf, fotograf va montajchilar"), { city: city ?? "" }),
    heading: translate(locale, tk("{city}dagi videograf, fotograf va montajchilar"), { city: city ?? "" }),
    description: translate(locale, tk("{city}dagi mobilograf, videograf, fotograf va montajchilar: {facts}. Paketlari, portfoliosi va mijozlar sharhlarini solishtiring."), { city: city ?? "", facts }),
  };
}

const clip = (text: string, max: number): string => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30)).replace(/[\s,.;:·-]+$/, "")}…`;
};

/**
 * The title and description of a creator's page: who they are, what they do and where, so a search for "mobilograf Andijon"
 * can match the page. The name and the headline stay as the creator wrote them; `category` is the reader's-language name.
 */
export function creatorMeta(c: { name: string; headline: string; category: string; city: string }, locale: Locale = DEFAULT_LOCALE): { title: string; description: string } {
  const city = labelFor(locale, c.city);
  const headline = c.headline.trim().replace(/[\s.!?,;:]+$/, "");
  return {
    title: `${c.name}: ${c.category}, ${city}`,
    description: clip([headline, c.category, city].filter(Boolean).join(" · "), 160),
  };
}

/**
 * `alternates` of a PUBLIC page: its own address in this language (self-canonical) and, while Russian is on, the pair of
 * languages for search engines (uz, ru, x-default -> uz). `path` has no language prefix. While Russian is off the locale is
 * always Uzbek and there are no alternates, so the result is `{ canonical: path }` as before.
 */
export function pageAlternates(locale: Locale, path: string, live: boolean = russianLive()) {
  const languages = hreflang(path, live);
  return { canonical: localHref(locale, path), ...(languages ? { languages } : {}) };
}

/** JSON for a <script type="application/ld+json">. "<" is escaped so a value can never close the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// ---------- search page: what is indexed ----------

export type SearchIndexing = { canonical: string; index: boolean };

/** The address of a landing view: the category, the city, or both, in this fixed order (so one view has one address). */
export function landingPath(category?: string, city?: string): string {
  const qs = [category ? `category=${encodeURIComponent(category)}` : "", city ? `city=${encodeURIComponent(city)}` : ""].filter(Boolean).join("&");
  return qs ? `/search?${qs}` : "/search";
}

const isCity = (v: string): boolean => (CITIES as readonly string[]).includes(v);

/** The parameters that cut the list: the empty ones (the search form sends all of them) and the default order are no cut at all. */
const setParams = (sp: Record<string, string | string[] | undefined>) =>
  Object.entries(sp).filter(([key, v]) => (Array.isArray(v) ? v.some((x) => x !== "") : v !== undefined && v !== "") && !(key === "sort" && v === "rating"));

/**
 * The category and/or city asked for, when the address carries nothing else: no search word, no price, no sort order, no
 * page number, no unknown parameter, and each of the two is one plain value. Null for any other address. Empty form
 * fields and the default order (`sort=rating`) are ignored. Whether the category and city are real is not decided here.
 */
export function landingRequest(sp: Record<string, string | string[] | undefined>): { category?: string; city?: string } | null {
  const set = setParams(sp);
  if (set.length === 0) return null;
  const out: { category?: string; city?: string } = {};
  for (const [key, value] of set) {
    if ((key !== "category" && key !== "city") || typeof value !== "string") return null;
    out[key] = value;
  }
  return out;
}

/**
 * /search is an indexed page. So is a LANDING view of it: one real category, one real city, or both together, and only
 * while it lists at least one creator (an empty page is not worth a place in a search result). Every other cut of the list
 * (a search word, a price, a sort order, a page number, an unknown parameter, an unknown city or category, an empty view)
 * is the same list cut another way: not indexed, its links still followed, canonical /search.
 */
export function searchIndexing(
  sp: Record<string, string | string[] | undefined>,
  known: { categoryExists: boolean; hasResults: boolean },
): SearchIndexing {
  if (setParams(sp).length === 0) return { canonical: "/search", index: true };
  const off: SearchIndexing = { canonical: "/search", index: false };
  const want = landingRequest(sp);
  if (!want || !known.hasResults) return off;
  if (want.category !== undefined && !known.categoryExists) return off;
  if (want.city !== undefined && !isCity(want.city)) return off;
  return { canonical: landingPath(want.category, want.city), index: true };
}

/** One row of "which creators are where": how many approved creators work in this city in this category (slug). */
export type LandingCombo = { city: string; category: string; count: number };

/**
 * Every landing view that has creators, from the counts above: the categories, the cities, and each category in each city.
 * Cities the site does not know (free text in the database) are left out. Sorted, so the sitemap is stable.
 */
export function landingViews(combos: LandingCombo[]): { category?: string; city?: string }[] {
  const real = combos.filter((c) => c.count > 0 && isCity(c.city));
  const categories = [...new Set(real.map((c) => c.category))].sort();
  const cities = [...new Set(real.map((c) => c.city))].sort();
  const both = real.map(({ category, city }) => ({ category, city })).sort((a, b) => `${a.category}|${a.city}`.localeCompare(`${b.category}|${b.city}`));
  return [...categories.map((category) => ({ category })), ...cities.map((city) => ({ city })), ...both];
}

// ---------- robots.txt ----------

export const PRIVATE_PATHS = ["/api/", "/admin", "/dashboard", "/orders", "/checkout", "/messages", "/settings", "/login", "/register", "/forbidden"];
/** Named so their owners can see they are welcome: AI search and assistant crawlers. */
export const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended"];

export function buildRobots(base: string = siteUrl()) {
  return {
    // A crawler obeys only the most specific group that names it, so the private paths are repeated for the named ones.
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

// ---------- JSON-LD ----------

const CONTEXT = "https://schema.org";
const orgId = (base: string) => `${base}/#organization`;
// Each language's home page is its own WebSite (the Russian one is `/ru#website`), so a crawler never reads two languages for one id.
const siteId = (base: string, locale: Locale = DEFAULT_LOCALE) => (locale === DEFAULT_LOCALE ? `${base}/#website` : `${base}${localHref(locale, "/")}#website`);
/** The address of a public page in this language, absolute. */
const pageUrl = (path: string, base: string, locale: Locale) => absoluteUrl(localHref(locale, path), base);

export function organizationJsonLd(base: string = siteUrl(), locale: Locale = DEFAULT_LOCALE) {
  return {
    "@context": CONTEXT,
    "@type": "Organization",
    "@id": orgId(base),
    name: SITE_NAME,
    url: pageUrl("/", base, locale),
    logo: absoluteUrl("/icon.svg", base),
    description: homeDescription(locale),
    areaServed: { "@type": "Country", name: "Uzbekistan" },
  };
}

export function websiteJsonLd(base: string = siteUrl(), locale: Locale = DEFAULT_LOCALE) {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    "@id": siteId(base, locale),
    name: SITE_NAME,
    url: pageUrl("/", base, locale),
    inLanguage: locale,
    publisher: { "@id": orgId(base) },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${pageUrl("/search", base, locale)}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export type Crumb = { name: string; path: string };

/** `name` is already in the reader's language; `path` has no language prefix. */
export function breadcrumbJsonLd(crumbs: Crumb[], base: string = siteUrl(), locale: Locale = DEFAULT_LOCALE) {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: pageUrl(c.path, base, locale) })),
  };
}

export function creatorListJsonLd(items: { slug: string; name: string }[], base: string = siteUrl(), locale: Locale = DEFAULT_LOCALE) {
  return {
    "@context": CONTEXT,
    "@type": "ItemList",
    numberOfItems: items.length,
    itemListElement: items.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.name, url: pageUrl(`/providers/${p.slug}`, base, locale) })),
  };
}

export type FaqItem = { question: string; answer: string };

/** `items` come from `buildFaq(..., locale)`, so they are already in the language. Uzbek output has no `inLanguage`, as before. */
export function faqJsonLd(items: FaqItem[], locale: Locale = DEFAULT_LOCALE) {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    ...(locale === DEFAULT_LOCALE ? {} : { inLanguage: locale }),
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

export type CreatorSeo = {
  slug: string;
  name: string;
  headline: string;
  bio?: string | null;
  city: string;
  category: string;
  languages: string[];
  /** A real picture of the creator, when the site has one. Never a placeholder. */
  image?: string | null;
  services: { title: string; description?: string | null; price: number }[];
  ratingAvg: number;
  ratingCount: number;
  /** How many reviews a visitor can actually read on the page. */
  visibleReviews: number;
};

/**
 * A creator's public page: the page itself, the person, and the service with one offer per active package.
 * The rating appears only when visitors can read real reviews on the page; it is never made up.
 * What the creator wrote (name, headline, bio, package titles and descriptions) goes in as written; `city`, `category`
 * and `languages` are the reader's-language labels the caller made (labelFor, categoryName).
 */
export function creatorJsonLd(c: CreatorSeo, base: string = siteUrl(), locale: Locale = DEFAULT_LOCALE) {
  const url = pageUrl(`/providers/${c.slug}`, base, locale);
  const personId = `${url}#person`;
  const person: Record<string, unknown> = {
    "@type": "Person",
    "@id": personId,
    name: c.name,
    description: c.headline,
    jobTitle: c.category,
    url,
    address: { "@type": "PostalAddress", addressLocality: c.city, addressCountry: "UZ" },
  };
  if (c.languages.length > 0) person.knowsLanguage = c.languages;
  if (c.image) person.image = c.image;

  const service: Record<string, unknown> = {
    "@type": "Service",
    "@id": `${url}#service`,
    name: `${c.name}: ${c.category}`,
    serviceType: c.category,
    description: c.bio?.trim() || c.headline,
    url,
    provider: { "@id": personId },
    areaServed: { "@type": "City", name: c.city },
  };
  if (c.services.length > 0) {
    service.offers = c.services.map((s) => {
      const offer: Record<string, unknown> = { "@type": "Offer", name: s.title, price: s.price, priceCurrency: "UZS", url };
      if (s.description) offer.description = s.description;
      return offer;
    });
  }
  if (c.visibleReviews > 0 && c.ratingCount > 0 && c.ratingAvg > 0) {
    service.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Math.round(c.ratingAvg * 10) / 10,
      reviewCount: c.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return {
    "@context": CONTEXT,
    "@graph": [
      { "@type": "ProfilePage", "@id": url, url, name: c.name, description: c.headline, inLanguage: locale, isPartOf: { "@id": siteId(base, locale) }, mainEntity: { "@id": personId } },
      person,
      service,
    ],
  };
}

// ---------- the home page FAQ (shown on the page, and the same text as FAQPage data) ----------

/**
 * Only what the site does today. The category names are the reader's-language names (categoryName); the cities are the
 * stored Uzbek values and are written in the reader's language here. No sentence promises anything about money.
 */
export function buildFaq(categoryNames: string[], cities: readonly string[], locale: Locale = DEFAULT_LOCALE): FaqItem[] {
  const t = (key: string, params?: Record<string, string>) => translate(locale, key, params);
  const directions = categoryNames.length > 0 ? `${t("Yoʻnalishlar: {names}.", { names: categoryNames.join(", ") })} ` : "";
  return [
    {
      question: t("Ijodkorni qanday topaman?"),
      answer: t(
        "Qidiruv sahifasida kerakli ishni soʻz bilan yozing yoki ijodkorlarni shahar, yoʻnalish va narx boʻyicha saralang. Har bir ijodkorning sahifasida paketlari, portfoliosi va mijozlar sharhlari koʻrinadi.",
      ),
    },
    {
      question: t("Buyurtma topshiriqdan tayyor videogacha qanday boradi?"),
      answer: t(
        "Ijodkorning paketini tanlab, topshiriqni yozib yuborasiz. Ijodkor uni koʻrib chiqadi, narx, muddat va tuzatishlar soni yozma kelishiladi va ikkala tomon shartlarni qabul qiladi. Ijodkor tayyor videoni sayt orqali topshiradi; kerak boʻlsa paketdagi tuzatishlar doirasida oʻzgartirish soʻraysiz, soʻng ishni qabul qilib sharh qoldirasiz.",
      ),
    },
    {
      question: t("Qaysi yoʻnalishlar va shaharlar bor?"),
      answer: `${directions}${t("Qidiruvda quyidagi shaharlar boʻyicha saralash mumkin: {cities}.", { cities: cities.map((c) => labelFor(locale, c)).join(", ") })}`,
    },
    {
      question: t("Ijodkor sifatida qanday qoʻshilaman?"),
      answer: t(
        "Ijodkor sifatida roʻyxatdan oʻting, profilingizni toʻldiring va paketlaringizni qoʻshing. Sayt maʼmurlari profilni koʻrib chiqadi va tasdiqlagach, u ijodkorlar roʻyxatida koʻrinadi.",
      ),
    },
  ];
}

// ---------- llms.txt ----------

export const LLMS_MAX_CREATORS = 500;
const oneLine = (s: string) => s.replace(/\s+/g, " ").replace(/[\[\]]/g, "").trim();

export function buildLlmsTxt(
  input: {
    categories: { slug: string; name: string }[];
    creators: { slug: string; name: string; headline: string; city: string }[];
    cities: readonly string[];
    /** The cities that have at least one creator: each has a page of its own. */
    cityPages?: readonly string[];
  },
  base: string = siteUrl(),
): string {
  const lines = [
    `# ${SITE_NAME}`,
    "",
    "> Tarmoq.uz is an online marketplace of video creators in Uzbekistan: mobile videographers, videographers, photographers and video editors. Clients browse creator profiles and order a package from a creator. The site is in Uzbek (Latin script).",
    "",
    "Facts about the site:",
    "",
    "- Every creator has a public profile with a headline, a description, a city, working languages, packages with prices in Uzbek soʻm (UZS), a portfolio and reviews.",
    "- A profile is listed only after the site's administrators have reviewed and approved it.",
    "- A review can be left only by a client whose order with that creator was completed.",
    "- An order starts with a written brief; the client and the creator agree on the price, the deadline and the number of revisions in writing, and the creator delivers the finished video through the site.",
    `- Creators can be filtered by city: ${input.cities.join(", ")}.`,
    "",
    "## Main pages",
    "",
    `- [Home](${base}/): featured creators and a search form`,
    `- [All creators](${base}/search): the full list, with filters for city, category and price`,
    `- [Sitemap](${base}/sitemap.xml): every public page`,
  ];
  if (input.categories.length > 0) {
    lines.push("", "## Categories", "");
    for (const c of input.categories) lines.push(`- [${oneLine(c.name)}](${base}/search?category=${encodeURIComponent(c.slug)})`);
  }
  if (input.cityPages && input.cityPages.length > 0) {
    lines.push("", "## Cities", "");
    for (const city of input.cityPages) lines.push(`- [${oneLine(city)}](${base}${landingPath(undefined, city)})`);
  }
  if (input.creators.length > 0) {
    lines.push("", "## Creators", "");
    for (const p of input.creators.slice(0, LLMS_MAX_CREATORS)) {
      lines.push(`- [${oneLine(p.name)}](${base}/providers/${p.slug}): ${oneLine(p.headline)} (${oneLine(p.city)})`);
    }
    if (input.creators.length > LLMS_MAX_CREATORS) lines.push(`- More creators: ${base}/search`);
  }
  return `${lines.join("\n")}\n`;
}
