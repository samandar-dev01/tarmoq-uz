// Data that is the SAME for every visitor, kept in Next's data cache for a short time.
//
// Why: every page is rendered per request (the layout reads the session and theme cookies), so before this file the home
// page, /search, the sitemap and llms.txt asked the database the same questions again for every visitor and every
// crawler, on a small free server. Only the database work is cached here, never the page: the page still reads the
// visitor's own cookies, so a signed-in person never sees someone else's data.
//
// Rules for what goes in here:
//  - Nothing that depends on the visitor (no cookies, no headers, no user id).
//  - Only JSON-safe values: a cached value comes back as JSON, so a Date would return as a string (see `getSitemapSource`).
//  - These functions only run while serving a request, never while the app is built (the build has no database).
//
// Freshness: a short lifetime on each entry, and `invalidatePublicListing()` after the writes that change what a visitor
// sees (an admin approves or suspends a creator, a creator saves the profile, a review changes a rating).
//
// If the SHAPE of a cached value ever changes, bump the `-v1` in its key: cached entries survive a redeploy.
import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "./db";
import { featuredProviders, SERVICE_SELECT } from "./providers";

const TAG = "public-listing";

/** Home page: how many creators the feed shows. */
export const FEATURED_COUNT = 6;

/** The category list (rarely changes): home page, search page. */
export const getCategories = unstable_cache(
  () => prisma.category.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true, nameRu: true } }),
  ["public-categories-v1"],
  { revalidate: 3600, tags: [TAG] },
);

/** The best-rated creators, in card shape, for the home page feed. */
export const getFeaturedProviders = unstable_cache(
  () => featuredProviders(FEATURED_COUNT),
  ["public-featured-v4"],
  { revalidate: 60, tags: [TAG] },
);

/** The home page's row of packages: from the best-rated creators first. */
export const getFeaturedServices = unstable_cache(
  () =>
    prisma.service.findMany({
      where: { isActive: true, profile: { status: "APPROVED", user: { isActive: true } } },
      orderBy: [{ profile: { ratingAvg: "desc" } }, { profile: { ratingCount: "desc" } }, { id: "asc" }],
      take: 12,
      select: SERVICE_SELECT,
    }),
  ["public-services-v2"],
  { revalidate: 60, tags: [TAG] },
);

/** What sitemap.xml needs. `updatedAt` is an ISO string because a cached value passes through JSON. */
export const getSitemapSource = unstable_cache(
  async () => {
    const [categories, creators] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: "asc" }, select: { slug: true } }),
      // The same rule as the public list: approved profiles of active accounts only.
      prisma.providerProfile.findMany({
        where: { status: "APPROVED", user: { isActive: true } },
        orderBy: { updatedAt: "desc" },
        take: 5000,
        select: { slug: true, updatedAt: true },
      }),
    ]);
    return { categories, creators: creators.map((c) => ({ slug: c.slug, updatedAt: c.updatedAt.toISOString() })) };
  },
  ["public-sitemap-v1"],
  { revalidate: 3600, tags: [TAG] },
);

/** What llms.txt needs: category names and the best-rated creators (one more than the file lists, to know if there are more). */
export const getLlmsSource = unstable_cache(
  async (creatorLimit: number) => {
    const [categories, creators] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
      prisma.providerProfile.findMany({
        where: { status: "APPROVED", user: { isActive: true } },
        orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { createdAt: "desc" }],
        take: creatorLimit,
        select: { slug: true, headline: true, city: true, user: { select: { name: true } } },
      }),
    ]);
    return { categories, creators };
  },
  ["public-llms-v1"],
  { revalidate: 3600, tags: [TAG] },
);

/**
 * Call AFTER a write that changes what the public lists show, from a route handler. Drops every entry above at once, so
 * the next visitor sees the change instead of waiting for the lifetime to run out. Never throws: a failed refresh must
 * not turn a saved change into an error for the person who made it.
 */
export function invalidatePublicListing(): void {
  try {
    revalidateTag(TAG, { expire: 0 });
  } catch (error) {
    console.error("invalidatePublicListing failed", error);
  }
}
