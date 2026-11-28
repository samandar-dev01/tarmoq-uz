import { translator } from "@/i18n/dictionary";
import { localHref } from "@/i18n/paths";
import { getLocale } from "@/i18n/server";
import { categoryName, CITIES, labelFor, LANGUAGES, SORTS } from "@/lib/constants";
import { LEVEL_LABEL } from "@/lib/levels";
import type { SearchFilters } from "@/lib/providers";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { cardClasses } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { SearchBox } from "@/components/SearchBox";

/** Plain GET form: works without JavaScript and keeps filters in the URL (shareable). */
export async function FilterPanel({
  filters,
  categories,
}: {
  filters: SearchFilters;
  categories: { slug: string; name: string; nameRu?: string | null }[];
}) {
  const locale = await getLocale();
  const t = translator(locale);
  return (
    // The key makes the form start over when the URL's filters change (a category pill, Tozalash, a link from home).
    // Without it React keeps what was typed and ignores the new defaults, so the form and the results would disagree.
    <form
      key={[filters.q, filters.city, filters.category, filters.sub, filters.minPrice, filters.maxPrice, filters.sort, filters.days, filters.level, filters.lang, filters.online].map((v) => v ?? "").join("|")}
      action={localHref(locale, "/search")}
      method="get"
      className={cardClasses({ padding: "md", className: "sm:p-6" })}
    >
      {/* Row one is what most people use: what, where, which kind. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
        <div className="sm:col-span-2 lg:col-span-1">
          <SearchBox label={t("Qidiruv")} defaultValue={filters.q} placeholder={t("Ism, xizmat yoki kalit soʻz")} />
        </div>
        <Field as="select" label={t("Shahar")} name="city" defaultValue={filters.city ?? ""}>
          <option value="">{t("Barcha shaharlar")}</option>
          {CITIES.map((c) => <option key={c} value={c}>{labelFor(locale, c)}</option>)}
        </Field>
        <Field as="select" label={t("Yoʻnalish")} name="category" defaultValue={filters.category ?? ""}>
          <option value="">{t("Barcha yoʻnalishlar")}</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{categoryName(locale, c)}</option>)}
        </Field>
      </div>
      {/* The chosen subdirection (its pills are under the form) is kept when the form is sent. */}
      {filters.sub && <input type="hidden" name="sub" value={filters.sub} />}
      {/* Row two narrows the list; the controls sit on one baseline even when a label wraps. */}
      <div className="mt-4 grid grid-cols-1 items-end gap-4 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <Field label={t("Eng kam narx (soʻm)")} name="minPrice" type="number" min={0} step={10000} inputMode="numeric" defaultValue={filters.minPrice} />
        <Field label={t("Eng yuqori narx (soʻm)")} name="maxPrice" type="number" min={0} step={10000} inputMode="numeric" defaultValue={filters.maxPrice} />
        <Field as="select" label={t("Saralash")} name="sort" defaultValue={filters.sort}>
          {Object.entries(SORTS).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
        </Field>
        <div className="flex items-center gap-3 sm:col-span-2 sm:justify-end lg:col-span-1">
          <ButtonLink href={localHref(locale, "/search")} variant="ghost">{t("Tozalash")}</ButtonLink>
          <Button type="submit">{t("Filtrlarni qoʻllash")}</Button>
        </div>
      </div>
      {/* Row three: how fast, who, and whether they are here now. */}
      <div className="mt-4 grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field as="select" label={t("Topshirish muddati")} name="days" defaultValue={filters.days ?? ""}>
          <option value="">{t("Istalgan muddat")}</option>
          {[1, 3, 7, 14].map((d) => <option key={d} value={d}>{t("{days} kun ichida", { days: d })}</option>)}
        </Field>
        <Field as="select" label={t("Ijodkor darajasi")} name="level" defaultValue={filters.level ?? ""}>
          <option value="">{t("Istalgan daraja")}</option>
          {([1, 2, 3] as const).map((l) => <option key={l} value={l}>{t(LEVEL_LABEL[l])}</option>)}
        </Field>
        <Field as="select" label={t("Ish tili")} name="lang" defaultValue={filters.lang ?? ""}>
          <option value="">{t("Istalgan til")}</option>
          {LANGUAGES.map((l) => <option key={l} value={l}>{labelFor(locale, l)}</option>)}
        </Field>
        <label className="flex min-h-12 items-center gap-3 font-semibold">
          <input type="checkbox" name="online" value="1" defaultChecked={filters.online === "1"} className="h-5 w-5" />
          {t("Hozir onlayn")}
        </label>
      </div>
      <p className="mt-4 text-sm text-ink-mute">{t("Narx filtri shu oraliqdagi paketlarni koʻrsatadi.")}</p>
    </form>
  );
}
