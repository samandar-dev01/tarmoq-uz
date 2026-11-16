import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { translator } from "@/i18n/dictionary";
import { localHref } from "@/i18n/paths";
import { getLocale } from "@/i18n/server";
import { plural } from "@/i18n/plural";
import { canBrowseCreators, getCurrentUser } from "@/lib/auth";
import { categoryName } from "@/lib/constants";
import { parseSearch, searchProviders } from "@/lib/providers";
import { breadcrumbJsonLd, creatorListJsonLd, ogDefaults, pageAlternates, searchIndexing, searchMeta } from "@/lib/seo";
import { searchCategoryHref, searchPageHref } from "@/lib/searchLinks";
import { JsonLd } from "@/components/seo/JsonLd";
import { FilterPanel } from "@/components/FilterPanel";
import { ProviderCard } from "@/components/ProviderCard";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// /search and /search?category=<real slug> are indexed pages of their own. Any other filter, search word or page number is
// the same list cut another way: not indexed (its links are still followed) and pointing back at /search (see searchIndexing).
export async function generateMetadata(props: Props): Promise<Metadata> {
  const sp = await props.searchParams;
  const locale = await getLocale();
  const slug = typeof sp.category === "string" ? sp.category : "";
  // Looked up exactly as written: " photography" or "PHOTOGRAPHY" is not a page of its own.
  const category = slug && slug.length <= 60 ? await prisma.category.findUnique({ where: { slug }, select: { name: true, nameRu: true } }) : null;
  const { canonical, index } = searchIndexing(sp, category !== null);
  const { title, description } = searchMeta(locale, category && index ? categoryName(locale, category) : null);
  // Self-canonical in this language (`/ru/search` for Russian); while Russian is on, the uz/ru/x-default pair as well.
  const alternates = pageAlternates(locale, canonical);
  return {
    title,
    description,
    alternates,
    openGraph: { ...ogDefaults(locale), title, description, url: alternates.canonical },
    // An indexable page says nothing (the default is index, follow); any other cut of the list says "noindex, follow".
    robots: index ? undefined : { index: false, follow: true },
  };
}

export default async function SearchPage(props: Props) {
  if (!canBrowseCreators(await getCurrentUser())) redirect("/forbidden");
  const locale = await getLocale();
  const t = translator(locale);
  const searchParams = await props.searchParams;
  const filters = parseSearch(searchParams);
  const [result, categories] = await Promise.all([
    searchProviders(filters),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true, nameRu: true } }),
  ]);

  // Every link goes through localHref (src/lib/searchLinks.ts): on a Russian page a crawler without cookies only meets /ru/... links.
  const pageHref = (page: number) => searchPageHref(locale, filters, page);
  const categoryHref = (slug?: string) => searchCategoryHref(locale, filters, slug);

  const activeCategory = categories.find((c) => c.slug === filters.category);
  const crumbs = [{ name: t("Bosh sahifa"), path: "/" }, { name: t("Ijodkorlarni toping"), path: "/search" }];
  if (activeCategory) crumbs.push({ name: categoryName(locale, activeCategory), path: `/search?category=${encodeURIComponent(activeCategory.slug)}` });

  return (
    <Container>
      <JsonLd data={breadcrumbJsonLd(crumbs, undefined, locale)} />
      <JsonLd data={creatorListJsonLd(result.items.map((p) => ({ slug: p.slug, name: p.user.name })), undefined, locale)} />
      <h1>{t("Ijodkorlarni toping")}</h1>
      <p className="mt-2 text-ink-soft">{t("Shahar, yoʻnalish va narx boʻyicha saralang.")}</p>
      <div className="mt-6">
        <FilterPanel filters={filters} categories={categories} />
      </div>
      {/* Named like the first pill, not like the select above it: two controls named "Yoʻnalish" cannot be told apart. */}
      <nav aria-label={t("Barcha yoʻnalishlar")} className="mt-5 flex flex-wrap gap-2">
        <ButtonLink href={categoryHref()} variant="chip" aria-current={filters.category ? undefined : "true"}>{t("Barcha yoʻnalishlar")}</ButtonLink>
        {categories.map((c) => (
          <ButtonLink key={c.slug} href={categoryHref(c.slug)} variant="chip" aria-current={filters.category === c.slug ? "true" : undefined}>{categoryName(locale, c)}</ButtonLink>
        ))}
      </nav>

      <p className="mt-8 font-semibold" aria-live="polite">
        {t("{count} topildi", { count: plural(locale, result.total, "ijodkor", ["креатор", "креатора", "креаторов"]) })}
      </p>

      {result.items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={t("Bu filtrlarga mos ijodkor topilmadi")}
            description={t("Narx oraligʻini kengaytiring, boshqa shaharni tanlang yoki qidiruv soʻzini olib tashlang.")}
            action={<ButtonLink href={localHref(locale, "/search")} variant="secondary">{t("Filtrlarni tozalash")}</ButtonLink>}
          />
        </div>
      ) : (
        <>
          {/* Four across when the count divides by four, otherwise three, so the last row is rarely a lone card. */}
          <div className={`mt-4 grid gap-5 sm:grid-cols-2 ${result.items.length % 4 === 0 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {result.items.map((p) => <ProviderCard key={p.id} p={p} />)}
          </div>
          {result.pages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-4" aria-label={t("Sahifalar")}>
              {result.page > 1 ? (
                <ButtonLink href={pageHref(result.page - 1)} variant="secondary" size="sm">{t("Oldingi")}</ButtonLink>
              ) : (
                <span className="px-3.5 text-sm font-bold text-ink-mute">{t("Oldingi")}</span>
              )}
              <span className="text-sm font-semibold">{t("Sahifa {page} / {pages}", { page: result.page, pages: result.pages })}</span>
              {result.page < result.pages ? (
                <ButtonLink href={pageHref(result.page + 1)} variant="secondary" size="sm">{t("Keyingi")}</ButtonLink>
              ) : (
                <span className="px-3.5 text-sm font-bold text-ink-mute">{t("Keyingi")}</span>
              )}
            </nav>
          )}
        </>
      )}
    </Container>
  );
}
