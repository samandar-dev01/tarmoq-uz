import type { MetadataRoute } from "next";
import { russianLive } from "@/i18n/config";
import { hreflang, localHref } from "@/i18n/paths";
import { getSitemapSource } from "@/lib/publicCache";
import { absoluteUrl, siteUrl } from "@/lib/site";

// Reads the database, so it is built per request and never at build time (the build has no database).
export const dynamic = "force-dynamic";

// The list of creators (up to 5 000, far below the 50 000 a sitemap may hold; split it before that is reached) comes from
// src/lib/publicCache.ts, which keeps it for an hour, so a crawler does not run a database query on every visit.

type Page = { path: string; lastModified?: Date; changeFrequency: "daily" | "weekly"; priority: number };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const source = await getSitemapSource();
  const categories = source.categories;
  // The cache hands dates back as text.
  const creators = source.creators.map((c) => ({ slug: c.slug, updatedAt: new Date(c.updatedAt) }));
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
