import { CITIES, SORTS } from "@/lib/constants";
import type { SearchFilters } from "@/lib/providers";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { cardClasses } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";

/** Plain GET form: works without JavaScript and keeps filters in the URL (shareable). */
export function FilterPanel({
  filters,
  categories,
}: {
  filters: SearchFilters;
  categories: { slug: string; name: string }[];
}) {
  return (
    <form action="/search" method="get" className={cardClasses({ padding: "md" })}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1.4fr_1fr_1fr]">
        <div>
          <Field label="Qidiruv" name="q" defaultValue={filters.q} placeholder="Ism, xizmat yoki kalit soʻz" />
        </div>
        <Field as="select" label="Shahar" name="city" defaultValue={filters.city ?? ""}>
          <option value="">Barcha shaharlar</option>
          {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Field>
        <Field as="select" label="Yoʻnalish" name="category" defaultValue={filters.category ?? ""}>
          <option value="">Barcha yoʻnalishlar</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </Field>
        <Field label="Eng kam narx (soʻm)" name="minPrice" type="number" min={0} step={10000} inputMode="numeric" defaultValue={filters.minPrice} />
        <Field label="Eng yuqori narx (soʻm)" name="maxPrice" type="number" min={0} step={10000} inputMode="numeric" defaultValue={filters.maxPrice} />
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="w-full sm:w-64">
          <Field as="select" label="Saralash" name="sort" defaultValue={filters.sort}>
            {Object.entries(SORTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <ButtonLink href="/search" variant="ghost">Tozalash</ButtonLink>
          <Button type="submit">Filtrlarni qoʻllash</Button>
        </div>
      </div>
      <p className="mt-3 text-sm text-ink-soft">Narx filtri belgilangan oraliqda paketi bor ijodkorlarni koʻrsatadi.</p>
    </form>
  );
}
