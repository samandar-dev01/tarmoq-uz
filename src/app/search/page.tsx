import Link from "next/link";
import { prisma } from "@/lib/db";
import { parseSearch, searchProviders } from "@/lib/providers";
import { FilterPanel } from "@/components/FilterPanel";
import { ProviderCard } from "@/components/ProviderCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Find creators" };

type Props = { searchParams: Record<string, string | string[] | undefined> };

export default async function SearchPage({ searchParams }: Props) {
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Find creators</h1>
      <div className="mt-4">
        <FilterPanel filters={filters} categories={categories} />
      </div>

      <p className="mt-6 text-sm text-slate-600" aria-live="polite">
        {result.total} {result.total === 1 ? "creator" : "creators"} found
      </p>

      {result.items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No creators match these filters"
            description="Try a wider price range, a different city, or remove the search keyword."
            action={<Link href="/search" className="text-sm font-medium text-indigo-600 hover:underline">Clear all filters</Link>}
          />
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((p) => <ProviderCard key={p.id} p={p} />)}
          </div>
          {result.pages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-4 text-sm" aria-label="Pagination">
              {result.page > 1 ? (
                <Link href={pageHref(result.page - 1)} className="font-medium text-indigo-600 hover:underline">← Previous</Link>
              ) : <span className="text-slate-400">← Previous</span>}
              <span>Page {result.page} of {result.pages}</span>
              {result.page < result.pages ? (
                <Link href={pageHref(result.page + 1)} className="font-medium text-indigo-600 hover:underline">Next →</Link>
              ) : <span className="text-slate-400">Next →</span>}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
