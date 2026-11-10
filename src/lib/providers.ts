import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { CITIES, PAGE_SIZE } from "./constants";

export const searchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  city: z.enum(CITIES).optional(),
  category: z.string().trim().max(60).optional(),
  minPrice: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  sort: z.enum(["rating", "price_asc", "price_desc", "newest"]).default("rating"),
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

export async function searchProviders(filters: SearchFilters, pageSize = PAGE_SIZE) {
  const { q, city, category, minPrice, maxPrice, sort, page } = filters;

  const where: Prisma.ProviderProfileWhereInput = {
    status: "APPROVED",
    user: { isActive: true },
  };
  if (city) where.city = city;
  if (category) where.category = { slug: category };
  // Price filter: provider has at least one active package inside the range.
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.services = { some: { isActive: true, price: { gte: minPrice, lte: maxPrice } } };
  }
  if (q) {
    where.OR = [
      { headline: { contains: q, mode: "insensitive" } },
      { bio: { contains: q, mode: "insensitive" } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { services: { some: { isActive: true, title: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [total, items] = await prisma.$transaction([
    prisma.providerProfile.count({ where }),
    prisma.providerProfile.findMany({
      where,
      orderBy: ORDER[sort],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, slug: true, headline: true, city: true, district: true,
        startingPrice: true, ratingAvg: true, ratingCount: true, languages: true,
        user: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
  ]);

  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export type ProviderCardData = Awaited<ReturnType<typeof searchProviders>>["items"][number];
