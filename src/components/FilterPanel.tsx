import Link from "next/link";
import { CITIES, SORTS } from "@/lib/constants";
import type { SearchFilters } from "@/lib/providers";

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500";
const label = "mb-1 block text-xs font-medium text-slate-600";

/** Plain GET form: works without JavaScript and keeps filters in the URL (shareable). */
export function FilterPanel({
  filters,
  categories,
}: {
  filters: SearchFilters;
  categories: { slug: string; name: string }[];
}) {
  return (
    <form action="/search" method="get" className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label htmlFor="q" className={label}>Search</label>
          <input id="q" name="q" defaultValue={filters.q} placeholder="Name, service, keyword" className={input} />
        </div>
        <div>
          <label htmlFor="city" className={label}>City</label>
          <select id="city" name="city" defaultValue={filters.city ?? ""} className={input}>
            <option value="">All cities</option>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="category" className={label}>Category</label>
          <select id="category" name="category" defaultValue={filters.category ?? ""} className={input}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="minPrice" className={label}>Min price (UZS)</label>
          <input id="minPrice" name="minPrice" type="number" min={0} step={10000} inputMode="numeric" defaultValue={filters.minPrice} className={input} />
        </div>
        <div>
          <label htmlFor="maxPrice" className={label}>Max price (UZS)</label>
          <input id="maxPrice" name="maxPrice" type="number" min={0} step={10000} inputMode="numeric" defaultValue={filters.maxPrice} className={input} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="w-full sm:w-56">
          <label htmlFor="sort" className={label}>Sort by</label>
          <select id="sort" name="sort" defaultValue={filters.sort} className={input}>
            {Object.entries(SORTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/search" className="text-sm font-medium text-slate-600 hover:text-slate-900">Reset</Link>
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
            Apply filters
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">Price filters match creators who have a package within your range.</p>
    </form>
  );
}
