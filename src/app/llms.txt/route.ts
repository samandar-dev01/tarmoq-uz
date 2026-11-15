import { prisma } from "@/lib/db";
import { CITIES } from "@/lib/constants";
import { buildLlmsTxt, LLMS_MAX_CREATORS } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

// A plain-text guide to the site for AI assistants. Reads the database, so it is never built at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  const [categories, creators] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    prisma.providerProfile.findMany({
      where: { status: "APPROVED", user: { isActive: true } },
      orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { createdAt: "desc" }],
      take: LLMS_MAX_CREATORS + 1,
      select: { slug: true, headline: true, city: true, user: { select: { name: true } } },
    }),
  ]);
  const body = buildLlmsTxt(
    { categories, cities: CITIES, creators: creators.map((p) => ({ slug: p.slug, name: p.user.name, headline: p.headline, city: p.city })) },
    siteUrl(),
  );
  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
