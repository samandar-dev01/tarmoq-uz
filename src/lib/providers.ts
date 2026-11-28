import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { CITIES, LANGUAGES, PAGE_SIZE } from "./constants";
import { findSubcategory } from "./catalog";
import { LEVEL_MINIMUM } from "./levels";
import { ONLINE_MS } from "./presence";
import { spellings, understand, type Concept } from "./searchWords";

export const searchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  city: z.enum(CITIES).optional(),
  category: z.string().trim().max(60).optional(),
  // A subdirection of that direction (src/lib/catalog.ts).
  sub: z.string().trim().max(60).optional(),
  minPrice: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  sort: z.enum(["rating", "price_asc", "price_desc", "newest"]).default("rating"),
  // More ways to narrow: delivery within so many days, the creator's level or higher, a working language, online now.
  days: z.coerce.number().pipe(z.union([z.literal(1), z.literal(3), z.literal(7), z.literal(14)])).optional(),
  level: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2), z.literal(3)])).optional(),
  lang: z.enum(LANGUAGES).optional(),
  online: z.literal("1").optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type SearchFilters = z.infer<typeof searchSchema>;

/** Lenient parsing: an invalid or empty param is ignored instead of failing the whole page. */
export function parseSearch(sp: Record<string, string | string[] | undefined>): SearchFilters {
  const out: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(searchSchema.shape)) {
    const value = sp[key];
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === undefined || raw === "") continue;
    const parsed = schema.safeParse(raw);
    if (parsed.success) out[key] = parsed.data;
  }
  const filters = searchSchema.parse(out);
  // A subdirection brings its direction with it; one that is unknown, or belongs to another direction, is dropped.
  if (filters.sub !== undefined) {
    const found = findSubcategory(filters.sub);
    if (found && (filters.category === undefined || filters.category === found.category.slug)) filters.category = found.category.slug;
    else delete filters.sub;
  }
  if (filters.minPrice !== undefined && filters.maxPrice !== undefined && filters.minPrice > filters.maxPrice) {
    [filters.minPrice, filters.maxPrice] = [filters.maxPrice, filters.minPrice];
  }
  return filters;
}

const ORDER: Record<SearchFilters["sort"], Prisma.ProviderProfileOrderByWithRelationInput[]> = {
  rating: [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { createdAt: "desc" }],
  price_asc: [{ startingPrice: "asc" }, { ratingAvg: "desc" }],
  price_desc: [{ startingPrice: "desc" }, { ratingAvg: "desc" }],
  newest: [{ createdAt: "desc" }],
};

/** What a creator card needs, and nothing else (no bio, no payout fields). */
export const CARD_SELECT = {
  id: true, slug: true, headline: true, city: true, district: true,
  startingPrice: true, ratingAvg: true, ratingCount: true, completedCount: true, languages: true,
  user: { select: { id: true, name: true, avatarUpdatedAt: true, lastSeenAt: true } },
  category: { select: { name: true, nameRu: true } },
  // The card's preview of the work (up to three pictures are shown; a few more are read for items with no picture).
  portfolio: { orderBy: { sortOrder: "asc" }, take: 8, select: { imageUrl: true, videoUrl: true } },
} satisfies Prisma.ProviderProfileSelect;

/** Who may be listed at all: approved profiles of active accounts. */
export const listedWhere = (): Prisma.ProviderProfileWhereInput => ({ status: "APPROVED", user: { isActive: true } });

function buildWhere(filters: SearchFilters): Prisma.ProviderProfileWhereInput {
  const { q, city, category, sub, minPrice, maxPrice } = filters;
  const where = listedWhere();
  if (city) where.city = city;
  if (category) where.category = { slug: category };
  // One of the creator's active packages has to match the price range and the subdirection together.
  if (minPrice !== undefined || maxPrice !== undefined || sub !== undefined) {
    where.services = { some: { isActive: true, price: { gte: minPrice, lte: maxPrice }, subcategory: sub } };
  }
  if (q) {
    where.OR = [
      { headline: { contains: q, mode: "insensitive" } },
      { bio: { contains: q, mode: "insensitive" } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { services: { some: { isActive: true, title: { contains: q, mode: "insensitive" } } } },
    ];
  }
  return where;
}

export async function searchProviders(filters: SearchFilters, pageSize = PAGE_SIZE) {
  const { sort, page } = filters;
  const where = buildWhere(filters);

  // Two plain reads at the same time. They used to run inside one transaction (BEGIN, count, select, COMMIT: four round
  // trips one after another); a count next to a list does not need to be one consistent snapshot.
  const [total, items] = await Promise.all([
    prisma.providerProfile.count({ where }),
    prisma.providerProfile.findMany({
      where,
      orderBy: ORDER[sort],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: CARD_SELECT,
    }),
  ]);

  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/**
 * The best-rated creators for the home page: the same cards and the same order as `searchProviders` with no filter, but
 * one query and no count (the home page never shows a total).
 */
export function featuredProviders(limit: number) {
  const filters = parseSearch({ sort: "rating" });
  return prisma.providerProfile.findMany({
    where: buildWhere(filters),
    orderBy: ORDER[filters.sort],
    take: limit,
    select: CARD_SELECT,
  });
}

export type ProviderCardData = Awaited<ReturnType<typeof featuredProviders>>[number];

// ---------- the search page lists packages ----------

/** What a package card needs. */
export const SERVICE_SELECT = {
  id: true, title: true, price: true, deliveryDays: true,
  profile: {
    select: {
      slug: true, ratingAvg: true, ratingCount: true, completedCount: true,
      user: { select: { id: true, name: true, avatarUpdatedAt: true, lastSeenAt: true } },
      portfolio: { orderBy: { sortOrder: "asc" }, take: 4, select: { imageUrl: true, videoUrl: true } },
    },
  },
} satisfies Prisma.ServiceSelect;
export type ServiceCardData = Prisma.ServiceGetPayload<{ select: typeof SERVICE_SELECT }>;

const SERVICE_ORDER: Record<SearchFilters["sort"], Prisma.ServiceOrderByWithRelationInput[]> = {
  rating: [{ profile: { ratingAvg: "desc" } }, { profile: { ratingCount: "desc" } }, { price: "asc" }, { id: "asc" }],
  price_asc: [{ price: "asc" }, { profile: { ratingAvg: "desc" } }, { id: "asc" }],
  price_desc: [{ price: "desc" }, { profile: { ratingAvg: "desc" } }, { id: "asc" }],
  newest: [{ profile: { createdAt: "desc" } }, { id: "desc" }],
};

export function serviceWhere(filters: SearchFilters, now = Date.now()): Prisma.ServiceWhereInput {
  const { q, city, category, sub, minPrice, maxPrice, days, level, lang, online } = filters;
  const user: Prisma.UserWhereInput = { isActive: true };
  if (online) user.lastSeenAt = { gt: new Date(now - ONLINE_MS) };
  const profile: Prisma.ProviderProfileWhereInput = { status: "APPROVED", user };
  if (city) profile.city = city;
  if (category) profile.category = { slug: category };
  if (lang) profile.languages = { has: lang };
  if (level) {
    const [completed, reviews, rating] = LEVEL_MINIMUM[level];
    profile.completedCount = { gte: completed };
    profile.ratingCount = { gte: reviews };
    profile.ratingAvg = { gte: rating };
  }
  const where: Prisma.ServiceWhereInput = { isActive: true, profile };
  if (minPrice !== undefined || maxPrice !== undefined) where.price = { gte: minPrice, lte: maxPrice };
  if (sub) where.subcategory = sub;
  if (days) where.deliveryDays = { lte: days };
  if (q) {
    const text = { contains: q, mode: "insensitive" as const };
    where.OR = [{ title: text }, { description: text }, { profile: { headline: text } }, { profile: { user: { name: text } } }];
  }
  return where;
}

const holds = (word: string) => ({ contains: word, mode: "insensitive" as const });

/**
 * A package answers a concept by its creator's direction, its subdirection or its own words. The creator's headline is
 * left out on purpose: one that mentions weddings would make each of their packages a wedding package.
 */
function answers({ categories, subs, written }: Concept): Prisma.ServiceWhereInput {
  const ways: Prisma.ServiceWhereInput[] = written.flatMap(spellings).flatMap((w) => [{ title: holds(w) }, { description: holds(w) }]);
  if (categories) ways.push({ profile: { category: { slug: { in: [...categories] } } } });
  if (subs) ways.push({ subcategory: { in: [...subs] } });
  return { OR: ways };
}

/** A package says a word that is no concept (a name, a camera): in its title or description, or its creator's headline or name. */
const says = (word: string): Prisma.ServiceWhereInput => ({
  OR: spellings(word).flatMap((w) => [{ title: holds(w) }, { description: holds(w) }, { profile: { headline: holds(w) } }, { profile: { user: { name: holds(w) } } }]),
});

/**
 * What to try, in order, when no package holds the phrase as typed (src/lib/searchWords.ts reads the sentence): first the
 * packages that answer everything it asks for, then, as `close` results, those that answer any of it. The other filters
 * (city, price, delivery...) always hold; a city named in the sentence counts when none was chosen.
 */
export function meaningSearches(filters: SearchFilters, now = Date.now()): { where: Prisma.ServiceWhereInput; close: boolean }[] {
  if (!filters.q) return [];
  const { concepts, words, city } = understand(filters.q);
  const asked = [...concepts.map(answers), ...words.map(says)];
  if (asked.length === 0 && !city) return [];
  const base = serviceWhere({ ...filters, q: undefined, city: filters.city ?? city ?? undefined }, now);
  const searches = [{ where: { ...base, AND: asked }, close: false }];
  // Close results go by what is wanted (the concepts); other words only when there is nothing else to go by.
  if (asked.length > 1) searches.push({ where: { ...base, AND: [{ OR: concepts.length > 0 ? concepts.map(answers) : words.map(says) }] }, close: true });
  return searches;
}

export async function searchServices(filters: SearchFilters, pageSize = PAGE_SIZE) {
  const { sort, page } = filters;
  const read = (where: Prisma.ServiceWhereInput) =>
    Promise.all([
      prisma.service.count({ where }),
      prisma.service.findMany({ where, orderBy: SERVICE_ORDER[sort], skip: (page - 1) * pageSize, take: pageSize, select: SERVICE_SELECT }),
    ]);
  let [total, items] = await read(serviceWhere(filters));
  let close = false;
  if (total === 0) {
    for (const search of meaningSearches(filters)) {
      [total, items] = await read(search.where);
      if (total > 0) {
        close = search.close;
        break;
      }
    }
  }
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), close };
}
