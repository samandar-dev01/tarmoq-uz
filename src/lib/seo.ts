// Pure builders for everything a search engine or an AI crawler reads: metadata pieces, JSON-LD, robots rules,
// llms.txt and the home page FAQ. No database and no request here, so every string they produce is unit-tested.
//
// HARD RULE: no payment promise in any of it. Payments run in manual or test mode and none of these places can
// carry the "Sinov rejimi" badge. A creator's real package price is a fact from the database and may be listed.
// tests/unit/seo.test.ts guards the wording.
import { absoluteUrl, SITE_NAME, siteUrl } from "./site";

/** The share picture (app/opengraph-image.tsx), as a path: Next makes it absolute with the layout's metadataBase. */
export const OG_IMAGE_PATH = "/opengraph-image";

/** A page that sets its own Open Graph block replaces the layout's whole block, so the shared part lives here. */
export function ogDefaults() {
  return {
    siteName: SITE_NAME,
    locale: "uz_UZ",
    type: "website" as const,
    images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: SITE_NAME }],
  };
}

export const HOME_TITLE = "Tarmoq.uz: Oʻzbekistondagi videograf, fotograf va montajchilar";
export const HOME_DESCRIPTION =
  "Oʻzbekiston shaharlaridagi mobilograf, videograf, fotograf va montajchilarni bir joydan toping: paketlari, portfoliosi va mijozlar sharhlarini solishtiring.";
export const SEARCH_TITLE = "Ijodkorlarni toping";
export const SEARCH_DESCRIPTION = "Oʻzbekistondagi videograf, fotograf va montajchilar roʻyxati. Shahar, yoʻnalish va narx boʻyicha saralang.";

/** JSON for a <script type="application/ld+json">. "<" is escaped so a value can never close the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// ---------- search page: what is indexed ----------

export type SearchIndexing = { canonical: string; index: boolean };

/**
 * /search and /search?category=<a real slug> are pages of their own. Every other combination (a search word, a city,
 * a price, a sort order, a page number, an unknown parameter) is the same list cut another way: not indexed, its
 * links still followed, canonical /search.
 */
export function searchIndexing(sp: Record<string, string | string[] | undefined>, categoryExists: boolean): SearchIndexing {
  const set = Object.entries(sp).filter(([, v]) => (Array.isArray(v) ? v.some((x) => x !== "") : v !== undefined && v !== ""));
  if (set.length === 0) return { canonical: "/search", index: true };
  const [key, value] = set[0]!;
  if (set.length === 1 && key === "category" && typeof value === "string" && categoryExists) {
    return { canonical: `/search?category=${encodeURIComponent(value)}`, index: true };
  }
  return { canonical: "/search", index: false };
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
const siteId = (base: string) => `${base}/#website`;

export function organizationJsonLd(base: string = siteUrl()) {
  return {
    "@context": CONTEXT,
    "@type": "Organization",
    "@id": orgId(base),
    name: SITE_NAME,
    url: `${base}/`,
    logo: absoluteUrl("/icon.svg", base),
    description: HOME_DESCRIPTION,
    areaServed: { "@type": "Country", name: "Uzbekistan" },
  };
}

export function websiteJsonLd(base: string = siteUrl()) {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    "@id": siteId(base),
    name: SITE_NAME,
    url: `${base}/`,
    inLanguage: "uz",
    publisher: { "@id": orgId(base) },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${base}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbJsonLd(crumbs: Crumb[], base: string = siteUrl()) {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absoluteUrl(c.path, base) })),
  };
}

export function creatorListJsonLd(items: { slug: string; name: string }[], base: string = siteUrl()) {
  return {
    "@context": CONTEXT,
    "@type": "ItemList",
    numberOfItems: items.length,
    itemListElement: items.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.name, url: absoluteUrl(`/providers/${p.slug}`, base) })),
  };
}

export type FaqItem = { question: string; answer: string };

export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
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
 */
export function creatorJsonLd(c: CreatorSeo, base: string = siteUrl()) {
  const url = absoluteUrl(`/providers/${c.slug}`, base);
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
      { "@type": "ProfilePage", "@id": url, url, name: c.name, description: c.headline, inLanguage: "uz", isPartOf: { "@id": siteId(base) }, mainEntity: { "@id": personId } },
      person,
      service,
    ],
  };
}

// ---------- the home page FAQ (shown on the page, and the same text as FAQPage data) ----------

/** Only what the site does today. The category names come from the database, the cities from the search filter. */
export function buildFaq(categoryNames: string[], cities: readonly string[]): FaqItem[] {
  const directions = categoryNames.length > 0 ? `Yoʻnalishlar: ${categoryNames.join(", ")}. ` : "";
  return [
    {
      question: "Ijodkorni qanday topaman?",
      answer:
        "Qidiruv sahifasida kerakli ishni soʻz bilan yozing yoki ijodkorlarni shahar, yoʻnalish va narx boʻyicha saralang. Har bir ijodkorning sahifasida paketlari, portfoliosi va mijozlar sharhlari koʻrinadi.",
    },
    {
      question: "Buyurtma topshiriqdan tayyor videogacha qanday boradi?",
      answer:
        "Ijodkorning paketini tanlab, topshiriqni yozib yuborasiz. Ijodkor uni koʻrib chiqadi, narx, muddat va tuzatishlar soni yozma kelishiladi va ikkala tomon shartlarni qabul qiladi. Ijodkor tayyor videoni sayt orqali topshiradi; kerak boʻlsa paketdagi tuzatishlar doirasida oʻzgartirish soʻraysiz, soʻng ishni qabul qilib sharh qoldirasiz.",
    },
    {
      question: "Qaysi yoʻnalishlar va shaharlar bor?",
      answer: `${directions}Qidiruvda quyidagi shaharlar boʻyicha saralash mumkin: ${cities.join(", ")}.`,
    },
    {
      question: "Ijodkor sifatida qanday qoʻshilaman?",
      answer:
        "Ijodkor sifatida roʻyxatdan oʻting, profilingizni toʻldiring va paketlaringizni qoʻshing. Sayt maʼmurlari profilni koʻrib chiqadi va tasdiqlagach, u ijodkorlar roʻyxatida koʻrinadi.",
    },
  ];
}

// ---------- llms.txt ----------

export const LLMS_MAX_CREATORS = 500;
const oneLine = (s: string) => s.replace(/\s+/g, " ").replace(/[\[\]]/g, "").trim();

export function buildLlmsTxt(
  input: { categories: { slug: string; name: string }[]; creators: { slug: string; name: string; headline: string; city: string }[]; cities: readonly string[] },
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
  if (input.creators.length > 0) {
    lines.push("", "## Creators", "");
    for (const p of input.creators.slice(0, LLMS_MAX_CREATORS)) {
      lines.push(`- [${oneLine(p.name)}](${base}/providers/${p.slug}): ${oneLine(p.headline)} (${oneLine(p.city)})`);
    }
    if (input.creators.length > LLMS_MAX_CREATORS) lines.push(`- More creators: ${base}/search`);
  }
  return `${lines.join("\n")}\n`;
}
