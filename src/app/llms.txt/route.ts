import { CITIES } from "@/lib/constants";
import { getLandingCombos, getLlmsSource } from "@/lib/publicCache";
import { buildLlmsTxt, landingViews, LLMS_MAX_CREATORS } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

// A plain-text guide to the site for AI assistants. Reads the database, so it is never built at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  // Kept for an hour in src/lib/publicCache.ts, so a crawler does not run a database query on every visit.
  const [{ categories, creators }, combos] = await Promise.all([getLlmsSource(LLMS_MAX_CREATORS + 1), getLandingCombos()]);
  const cityPages = landingViews(combos).flatMap((v) => (v.city && !v.category ? [v.city] : []));
  const body = buildLlmsTxt(
    { categories, cities: CITIES, cityPages, creators: creators.map((p) => ({ slug: p.slug, name: p.user.name, headline: p.headline, city: p.city })) },
    siteUrl(),
  );
  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
