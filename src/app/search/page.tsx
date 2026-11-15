import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canBrowseCreators, getCurrentUser } from "@/lib/auth";
import { parseSearch, searchProviders } from "@/lib/providers";
import { breadcrumbJsonLd, creatorListJsonLd, ogDefaults, SEARCH_DESCRIPTION, searchIndexing } from "@/lib/seo";
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
  const slug = typeof sp.category === "string" ? sp.category : "";
  // Looked up exactly as written: " photography" or "PHOTOGRAPHY" is not a page of its own.
  const category = slug && slug.length <= 60 ? await prisma.category.findUnique({ where: { slug }, select: { name: true } }) : null;
  const { canonical, index } = searchIndexing(sp, category !== null);
  const title = category && index ? `${category.name}: ijodkorlarni toping` : "Ijodkorlarni toping";
  const description = category && index ? `Oʻzbekistondagi ${category.name.toLowerCase()} yoʻnalishidagi ijodkorlar roʻyxati. Shahar va narx boʻyicha saralang.` : SEARCH_DESCRIPTION;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { ...ogDefaults(), title, description, url: canonical },
    // An indexable page says nothing (the default is index, follow); any other cut of the list says "noindex, follow".
    robots: index ? undefined : { index: false, follow: true },
  };
}

export default async function SearchPage(props: Props) {
  if (!canBrowseCreators(await getCurrentUser())) redirect("/forbidden");
  const searchParams = await props.searchParams;
  const filters = parseSearch(searchParams);
  const [result, categories] = await Promise.all([
    searchProviders(filters),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);

  const pageHref = (page: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== "" && k !== "page") qs.set(k, String(v));
    }
    if (page > 1) qs.set("page", String(page));
    return `/search?${qs.toString()}`;
  };
  // A pill changes only the category: every other filter stays, and the page number starts over.
  const categoryHref = (slug?: string) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== "" && k !== "page" && k !== "category") qs.set(k, String(v));
    }
    if (slug) qs.set("category", slug);
    const query = qs.toString();
    return query ? `/search?${query}` : "/search";
  };

  const activeCategory = categories.find((c) => c.slug === filters.category);
  const crumbs = [{ name: "Bosh sahifa", path: "/" }, { name: "Ijodkorlarni toping", path: "/search" }];
  if (activeCategory) crumbs.push({ name: activeCategory.name, path: `/search?category=${encodeURIComponent(activeCategory.slug)}` });

  return (
    <Container>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={creatorListJsonLd(result.items.map((p) => ({ slug: p.slug, name: p.user.name })))} />
      <h1>Ijodkorlarni toping</h1>
      <p className="mt-2 text-ink-soft">Shahar, yoʻnalish va narx boʻyicha saralang.</p>
      <div className="mt-6">
        <FilterPanel filters={filters} categories={categories} />
      </div>
      {/* Named like the first pill, not like the select above it: two controls named "Yoʻnalish" cannot be told apart. */}
      <nav aria-label="Barcha yoʻnalishlar" className="mt-5 flex flex-wrap gap-2">
        <ButtonLink href={categoryHref()} variant="chip" aria-current={filters.category ? undefined : "true"}>Barcha yoʻnalishlar</ButtonLink>
        {categories.map((c) => (
          <ButtonLink key={c.slug} href={categoryHref(c.slug)} variant="chip" aria-current={filters.category === c.slug ? "true" : undefined}>{c.name}</ButtonLink>
        ))}
      </nav>

      <p className="mt-8 font-semibold" aria-live="polite">
        {result.total} ta ijodkor topildi
      </p>

      {result.items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Bu filtrlarga mos ijodkor topilmadi"
            description="Narx oraligʻini kengaytiring, boshqa shaharni tanlang yoki qidiruv soʻzini olib tashlang."
            action={<ButtonLink href="/search" variant="secondary">Filtrlarni tozalash</ButtonLink>}
          />
        </div>
      ) : (
        <>
          {/* Four across when the count divides by four, otherwise three, so the last row is rarely a lone card. */}
          <div className={`mt-4 grid gap-5 sm:grid-cols-2 ${result.items.length % 4 === 0 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {result.items.map((p) => <ProviderCard key={p.id} p={p} />)}
          </div>
          {result.pages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-4" aria-label="Sahifalar">
              {result.page > 1 ? (
                <ButtonLink href={pageHref(result.page - 1)} variant="secondary" size="sm">Oldingi</ButtonLink>
              ) : (
                <span className="px-3.5 text-sm font-bold text-ink-mute">Oldingi</span>
              )}
              <span className="text-sm font-semibold">Sahifa {result.page} / {result.pages}</span>
              {result.page < result.pages ? (
                <ButtonLink href={pageHref(result.page + 1)} variant="secondary" size="sm">Keyingi</ButtonLink>
              ) : (
                <span className="px-3.5 text-sm font-bold text-ink-mute">Keyingi</span>
              )}
            </nav>
          )}
        </>
      )}
    </Container>
  );
}
