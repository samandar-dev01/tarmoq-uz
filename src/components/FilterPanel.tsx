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
    // The key makes the form start over when the URL's filters change (a category pill, Tozalash, a link from home).
    // Without it React keeps what was typed and ignores the new defaults, so the form and the results would disagree.
    <form
      key={[filters.q, filters.city, filters.category, filters.minPrice, filters.maxPrice, filters.sort].map((v) => v ?? "").join("|")}
      action="/search"
      method="get"
      className={cardClasses({ padding: "md", className: "sm:p-6" })}
    >
      {/* Row one is what most people use: what, where, which kind. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
        <div className="sm:col-span-2 lg:col-span-1">
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
      </div>
      {/* Row two narrows the list; the controls sit on one baseline even when a label wraps. */}
      <div className="mt-4 grid grid-cols-1 items-end gap-4 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <Field label="Eng kam narx (soʻm)" name="minPrice" type="number" min={0} step={10000} inputMode="numeric" defaultValue={filters.minPrice} />
        <Field label="Eng yuqori narx (soʻm)" name="maxPrice" type="number" min={0} step={10000} inputMode="numeric" defaultValue={filters.maxPrice} />
        <Field as="select" label="Saralash" name="sort" defaultValue={filters.sort}>
          {Object.entries(SORTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Field>
        <div className="flex items-center gap-3 sm:col-span-2 sm:justify-end lg:col-span-1">
          <ButtonLink href="/search" variant="ghost">Tozalash</ButtonLink>
          <Button type="submit">Filtrlarni qoʻllash</Button>
        </div>
      </div>
      <p className="mt-4 text-sm text-ink-mute">Narx filtri belgilangan oraliqda paketi bor ijodkorlarni koʻrsatadi.</p>
    </form>
  );
}
