import { prisma } from "@/lib/db";
import { parseSearch, searchProviders } from "@/lib/providers";
import { FilterPanel } from "@/components/FilterPanel";
import { ProviderCard } from "@/components/ProviderCard";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Ijodkorlarni toping" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SearchPage(props: Props) {
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

  return (
    <Container>
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
