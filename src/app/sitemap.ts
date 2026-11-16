import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site";

// Reads the database, so it is built per request and never at build time (the build has no database).
export const dynamic = "force-dynamic";

/** Far below the 50 000 a sitemap may hold; one query. Split into several sitemaps before this is ever reached. */
const MAX_CREATORS = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [categories, creators] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { slug: true } }),
    // The same rule as the public list: approved profiles of active accounts only.
    prisma.providerProfile.findMany({
      where: { status: "APPROVED", user: { isActive: true } },
      orderBy: { updatedAt: "desc" },
      take: MAX_CREATORS,
      select: { slug: true, updatedAt: true },
    }),
  ]);
  const newest = creators[0]?.updatedAt;
  return [
    { url: `${base}/`, lastModified: newest, changeFrequency: "daily", priority: 1 },
    { url: `${base}/search`, lastModified: newest, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((c) => ({ url: `${base}/search?category=${encodeURIComponent(c.slug)}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...creators.map((p) => ({ url: `${base}/providers/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
