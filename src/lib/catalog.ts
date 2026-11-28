import type { Locale } from "../i18n/config";

/**
 * The directions and their subdirections, as fixed data: the category bar and the footer are on every page, and the
 * pages must not need the database for them (the host's health check opens /login even while the database is asleep).
 * The category slugs and names are the ones prisma/seed.ts writes (tests/unit/catalog.test.ts keeps them equal).
 * A subcategory's slug is what a service stores, so it never changes once creators have chosen it.
 */
export type CatalogEntry = { slug: string; name: string; nameRu: string };
export type CatalogCategory = CatalogEntry & { subcategories: readonly CatalogEntry[] };

export const CATALOG: readonly CatalogCategory[] = [
  {
    slug: "mobile-videography", name: "Mobilografiya", nameRu: "Мобильная съёмка",
    subcategories: [
      { slug: "reels", name: "Reels va TikTok", nameRu: "Reels и TikTok" },
      { slug: "mobile-events", name: "Toʻy va tadbirlar", nameRu: "Свадьбы и мероприятия" },
      { slug: "business-ads", name: "Biznes reklamasi", nameRu: "Реклама для бизнеса" },
      { slug: "product-video", name: "Mahsulot videolari", nameRu: "Видео товаров" },
    ],
  },
  {
    slug: "photography", name: "Fotografiya", nameRu: "Фотография",
    subcategories: [
      { slug: "wedding-photo", name: "Toʻy fotosurati", nameRu: "Свадебная фотосъёмка" },
      { slug: "portrait", name: "Portret", nameRu: "Портрет" },
      { slug: "product-photo", name: "Mahsulot fotosurati", nameRu: "Предметная съёмка" },
      { slug: "event-photo", name: "Tadbirlar", nameRu: "Мероприятия" },
    ],
  },
  {
    slug: "video-editing", name: "Video montaj", nameRu: "Видеомонтаж",
    subcategories: [
      { slug: "short-edit", name: "Qisqa videolar montaji", nameRu: "Монтаж коротких видео" },
      { slug: "wedding-edit", name: "Toʻy videosi montaji", nameRu: "Монтаж свадебного видео" },
      { slug: "youtube-edit", name: "YouTube montaji", nameRu: "Монтаж для YouTube" },
      { slug: "subtitles", name: "Subtitr va grafika", nameRu: "Субтитры и графика" },
    ],
  },
  {
    slug: "drone", name: "Dron bilan suratga olish", nameRu: "Съёмка с дрона",
    subcategories: [
      { slug: "drone-events", name: "Toʻy va tadbirlarni dronda olish", nameRu: "Свадьбы и мероприятия с дрона" },
      { slug: "real-estate", name: "Koʻchmas mulk", nameRu: "Недвижимость" },
      { slug: "drone-ads", name: "Reklama roliklari", nameRu: "Рекламные ролики" },
      { slug: "travel", name: "Tabiat va sayohat", nameRu: "Природа и путешествия" },
    ],
  },
];

export const catalogName = (locale: Locale, entry: CatalogEntry): string => (locale === "ru" ? entry.nameRu : entry.name);

/** The category a slug names, or undefined. */
export const findCategory = (slug: string | null | undefined): CatalogCategory | undefined => CATALOG.find((c) => c.slug === slug);

/** The subcategory a slug names, with its category, or undefined. Subcategory slugs are unique across categories. */
export function findSubcategory(slug: string | null | undefined): { category: CatalogCategory; subcategory: CatalogEntry } | undefined {
  for (const category of CATALOG) {
    const subcategory = category.subcategories.find((s) => s.slug === slug);
    if (subcategory) return { category, subcategory };
  }
  return undefined;
}
