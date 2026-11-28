import { canBrowseCreators, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clientIp, HttpError, handle, ok } from "@/lib/http";
import { localeOfRequest } from "@/i18n/config";
import { localHref } from "@/i18n/paths";
import { listedWhere } from "@/lib/providers";
import { rateLimit } from "@/lib/rateLimit";
import { providerHref } from "@/lib/searchLinks";
import { catalogSuggestions, type Suggestion } from "@/lib/suggestMatch";

/** Suggestions for a search box: directions first, then creators and packages. Only what the public search shows. */
export const GET = handle(async (req) => {
  if (!canBrowseCreators(await getCurrentUser())) throw new HttpError(403, "Buning uchun sizda ruxsat yoʻq.");
  if (!rateLimit(`suggest:${clientIp(req)}`, 120, 60 * 1000)) throw new HttpError(429, "Urinishlar juda koʻp. Birozdan keyin qayta urinib koʻring.");
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return ok({ suggestions: [] });
  const locale = localeOfRequest(req);
  const [creators, services] = await Promise.all([
    prisma.providerProfile.findMany({
      where: { ...listedWhere(), user: { isActive: true, name: { contains: q, mode: "insensitive" } } },
      orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
      take: 4,
      select: { slug: true, user: { select: { name: true } } },
    }),
    prisma.service.findMany({
      where: { isActive: true, title: { contains: q, mode: "insensitive" }, profile: listedWhere() },
      take: 4,
      orderBy: { id: "asc" },
      select: { title: true, profile: { select: { slug: true } } },
    }),
  ]);
  const suggestions: Suggestion[] = [
    ...catalogSuggestions(locale, q).map((s) => ({ ...s, href: localHref(locale, s.href) })),
    ...creators.map((c) => ({ label: c.user.name, kind: "creator" as const, href: providerHref(locale, c.slug) })),
    ...services.map((s) => ({ label: s.title, kind: "service" as const, href: providerHref(locale, s.profile.slug) })),
  ];
  return ok({ suggestions });
});
