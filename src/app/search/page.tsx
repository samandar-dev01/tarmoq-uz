import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { translator } from "@/i18n/dictionary";
import { localHref } from "@/i18n/paths";
import { getLocale } from "@/i18n/server";
import { plural } from "@/i18n/plural";
import { canBrowseCreators, getCurrentUser } from "@/lib/auth";
import { categoryName, CITIES, labelFor } from "@/lib/constants";
import { landingFacts, parseSearch, searchProviders } from "@/lib/providers";
import { getCategories, getLandingCombos } from "@/lib/publicCache";
import { breadcrumbJsonLd, creatorListJsonLd, landingPath, landingRequest, ogDefaults, pageAlternates, searchIndexing, searchMeta, type Landing } from "@/lib/seo";
import { searchCategoryHref, searchCityHref, searchPageHref } from "@/lib/searchLinks";
import { JsonLd } from "@/components/seo/JsonLd";
import { FilterPanel } from "@/components/FilterPanel";
import { ProviderCard } from "@/components/ProviderCard";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * What an address that asks only for a category and/or a city is: the category if it is a real one (looked up exactly as
 * written: " photography" or "PHOTOGRAPHY" is not a page of its own) and how many creators the view lists. Both
 * `generateMetadata` and the page need it, so it is read once per request.
 */
const getView = cache(async (slug: string, city: string) => {
  const category = slug && slug.length <= 60 ? await prisma.category.findUnique({ where: { slug }, select: { slug: true, name: true, nameRu: true } }) : null;
  const real = (slug === "" || category !== null) && (city === "" || (CITIES as readonly string[]).includes(city)) && (slug !== "" || city !== "");
  const facts = real ? await landingFacts(slug || undefined, city || undefined) : null;
  return { category, facts };
});

/** The words of a landing view, or null when the address is the plain search or any other cut of the list. */
function landingOf(locale: Parameters<typeof searchMeta>[0], want: { city?: string } | null, view: Awaited<ReturnType<typeof getView>> | null, index: boolean): Landing | null {
  if (!index || !want || !view?.facts) return null;
  return {
    category: view.category ? categoryName(locale, view.category) : null,
    city: want.city ?? null,
    count: view.facts.count,
    fromPrice: view.facts.fromPrice,
  };
}

// /search is an indexed page, and so is each landing view of it: one real category, one real city, or both, while it lists
// at least one creator. Any other filter, search word or page number is the same list cut another way: not indexed (its
// links are still followed) and pointing back at /search (see searchIndexing).
export async function generateMetadata(props: Props): Promise<Metadata> {
  const sp = await props.searchParams;
  const locale = await getLocale();
  const want = landingRequest(sp);
  const view = want ? await getView(want.category ?? "", want.city ?? "") : null;
  const { canonical, index } = searchIndexing(sp, { categoryExists: view?.category != null, hasResults: (view?.facts?.count ?? 0) > 0 });
  const { title, description } = searchMeta(locale, landingOf(locale, want, view, index));
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
  const want = landingRequest(searchParams);
  const [result, categories, combos, view] = await Promise.all([
    searchProviders(filters),
    getCategories(),
    getLandingCombos(),
    want ? getView(want.category ?? "", want.city ?? "") : null,
  ]);
  const { index } = searchIndexing(searchParams, { categoryExists: view?.category != null, hasResults: (view?.facts?.count ?? 0) > 0 });
  const landing = landingOf(locale, want, view, index);
  const meta = searchMeta(locale, landing);

  // Every link goes through localHref (src/lib/searchLinks.ts): on a Russian page a crawler without cookies only meets /ru/... links.
  const pageHref = (page: number) => searchPageHref(locale, filters, page);
  const categoryHref = (slug?: string) => searchCategoryHref(locale, filters, slug);
  const cityHref = (city?: string) => searchCityHref(locale, filters, city);
  // Only the cities that have creators (in the chosen category, when there is one), and the chosen city itself, so a chip never leads to an empty page.
  const cityChips = CITIES.filter((c) => c === filters.city || combos.some((x) => x.city === c && x.count > 0 && (!filters.category || x.category === filters.category)));

  const activeCategory = categories.find((c) => c.slug === filters.category);
  const crumbs = [{ name: t("Bosh sahifa"), path: "/" }, { name: t("Ijodkorlarni toping"), path: "/search" }];
  if (activeCategory) crumbs.push({ name: categoryName(locale, activeCategory), path: landingPath(activeCategory.slug) });
  if (filters.city && landing) crumbs.push({ name: labelFor(locale, filters.city), path: landingPath(activeCategory?.slug, filters.city) });

  return (
    <Container>
      <JsonLd data={breadcrumbJsonLd(crumbs, undefined, locale)} />
      <JsonLd data={creatorListJsonLd(result.items.map((p) => ({ slug: p.slug, name: p.user.name })), undefined, locale)} />
      <h1>{meta.heading ?? t("Ijodkorlarni toping")}</h1>
      <p className="mt-2 text-ink-soft">{meta.heading ? meta.description : t("Shahar, yoʻnalish va narx boʻyicha saralang.")}</p>
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
      {/* The same for cities: every chip is a plain link to a view of its own, which is how search engines find the city pages. */}
      {cityChips.length > 0 && (
        <nav aria-label={t("Barcha shaharlar")} className="mt-3 flex flex-wrap gap-2">
          <ButtonLink href={cityHref()} variant="chip" aria-current={filters.city ? undefined : "true"}>{t("Barcha shaharlar")}</ButtonLink>
          {cityChips.map((c) => (
            <ButtonLink key={c} href={cityHref(c)} variant="chip" aria-current={filters.city === c ? "true" : undefined}>{labelFor(locale, c)}</ButtonLink>
          ))}
        </nav>
      )}

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
