import type { MetadataRoute } from "next";
import { russianLive } from "@/i18n/config";
import { hreflang, localHref } from "@/i18n/paths";
import { prisma } from "@/lib/db";
import { absoluteUrl, siteUrl } from "@/lib/site";

// Reads the database, so it is built per request and never at build time (the build has no database).
export const dynamic = "force-dynamic";

/** Far below the 50 000 a sitemap may hold; one query. Split into several sitemaps before this is ever reached. */
const MAX_CREATORS = 5000;

type Page = { path: string; lastModified?: Date; changeFrequency: "daily" | "weekly"; priority: number };

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
  const pages: Page[] = [
    { path: "/", lastModified: newest, changeFrequency: "daily", priority: 1 },
    { path: "/search", lastModified: newest, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((c) => ({ path: `/search?category=${encodeURIComponent(c.slug)}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...creators.map((p) => ({ path: `/providers/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];

  // Russian off (the live site today): exactly the Uzbek list, with no alternates.
  if (!russianLive()) return pages.map((p) => ({ url: absoluteUrl(p.path, base), lastModified: p.lastModified, changeFrequency: p.changeFrequency, priority: p.priority }));

  // Russian on: every public page is listed twice, at its own address in each language, and each entry names the other
  // (hreflang uz, ru and x-default -> Uzbek), the same pair the page itself carries in its <head>.
  const entry = (p: Page, lang: "uz" | "ru"): MetadataRoute.Sitemap[number] => ({
    url: absoluteUrl(localHref(lang, p.path), base),
    lastModified: p.lastModified,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
    alternates: { languages: Object.fromEntries(Object.entries(hreflang(p.path, true)!).map(([code, path]) => [code, absoluteUrl(path, base)])) },
  });
  return [...pages.map((p) => entry(p, "uz")), ...pages.map((p) => entry(p, "ru"))];
}
