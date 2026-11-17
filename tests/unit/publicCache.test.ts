import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
// The data cache needs Next's runtime: a pass-through stands in, so these tests are about what this file does around it.
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag }));

const { catFindMany, profileFindMany } = vi.hoisted(() => ({ catFindMany: vi.fn(), profileFindMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { category: { findMany: catFindMany }, providerProfile: { findMany: profileFindMany } } }));

import { FEATURED_COUNT, getFeaturedProviders, getSitemapSource, invalidatePublicListing } from "@/lib/publicCache";

beforeEach(() => {
  revalidateTag.mockReset();
  catFindMany.mockReset();
  profileFindMany.mockReset();
});

describe("invalidatePublicListing", () => {
  it("drops the public entries at once (expire 0), under the one tag every cached list carries", () => {
    invalidatePublicListing();
    expect(revalidateTag).toHaveBeenCalledWith("public-listing", { expire: 0 });
  });

  it("never throws: a failed refresh must not turn a saved change into an error", () => {
    revalidateTag.mockImplementation(() => {
      throw new Error("no cache here");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => invalidatePublicListing()).not.toThrow();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("the cached lists hold only values that survive JSON", () => {
  it("the sitemap source gives dates as ISO text and comes back identical after a JSON round trip", async () => {
    catFindMany.mockResolvedValue([{ slug: "photography" }]);
    profileFindMany.mockResolvedValue([{ slug: "jasur", updatedAt: new Date("2026-11-10T00:00:00Z") }]);
    const source = await getSitemapSource();
    expect(source.creators).toEqual([{ slug: "jasur", updatedAt: "2026-11-10T00:00:00.000Z" }]);
    expect(JSON.parse(JSON.stringify(source))).toEqual(source);
  });

  it("the featured list asks for the home page's six creators, best rated first, with no count", async () => {
    profileFindMany.mockResolvedValue([]);
    await getFeaturedProviders();
    expect(FEATURED_COUNT).toBe(6);
    expect(profileFindMany).toHaveBeenCalledTimes(1);
    const arg = profileFindMany.mock.calls[0]![0];
    expect(arg.take).toBe(FEATURED_COUNT);
    expect(arg.where).toMatchObject({ status: "APPROVED", user: { isActive: true } });
    expect(arg.orderBy).toEqual([{ ratingAvg: "desc" }, { ratingCount: "desc" }, { createdAt: "desc" }]);
  });
});
