import { ButtonLink } from "@/components/ui/ButtonLink";
import { cardClasses } from "@/components/ui/Card";
import { translator } from "@/i18n/dictionary";
import { getLocale } from "@/i18n/server";
import { formatUZS } from "@/lib/format";

/** The most packages that sit side by side: the first three of the list (the cheapest, the page sorts by price). */
export const COMPARE_LIMIT = 3;

export type ComparedPackage = { id: string; title: string; description: string; price: number; deliveryDays: number; revisions: number };

/**
 * A creator's packages side by side, one column each, so they can be read across. Drawn only when there are at least two
 * to compare. The order button appears in a column only when `orderHref` is given (the viewer may order).
 */
export async function PackageCompare({ packages, orderHref }: { packages: ComparedPackage[]; orderHref?: (id: string) => string }) {
  if (packages.length < 2) return null;
  const locale = await getLocale();
  const t = translator(locale);
  const columns = packages.slice(0, COMPARE_LIMIT);
  const rows: [string, (p: ComparedPackage) => string][] = [
    [t("Nimalar kiradi?"), (p) => p.description],
    [t("Muddat"), (p) => t("{days} kunda topshiriladi", { days: p.deliveryDays })],
    [t("Tuzatishlar"), (p) => t("{count} ta tuzatish", { count: p.revisions })],
  ];
  const cell = "border-t border-line p-4 align-top";
  return (
    // Three columns do not fit a phone, where the package cards above already stack one under another.
    <section className="hidden md:block">
      <h2>{t("Paketlarni solishtirish")}</h2>
      <div className={cardClasses({ padding: "none", className: "mt-4 overflow-hidden" })}>
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr>
              <td className="w-32 p-4" />
              {columns.map((p) => (
                <th key={p.id} scope="col" className="p-4 align-top font-normal">
                  <span className="block text-lg font-extrabold tabular-nums tracking-tight">{formatUZS(p.price, locale)}</span>
                  <span className="mt-1 block font-bold">{p.title}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row" className={`${cell} text-sm font-semibold text-ink-soft`}>{label}</th>
                {columns.map((p) => (
                  <td key={p.id} className={`${cell} text-[0.9375rem]`}>{value(p)}</td>
                ))}
              </tr>
            ))}
            {orderHref && (
              <tr>
                <td className={cell} />
                {columns.map((p) => (
                  <td key={p.id} className={cell}>
                    <ButtonLink href={orderHref(p.id)} variant="secondary" className="w-full" aria-label={`${t("Buyurtma berish")}: ${p.title}`}>{t("Buyurtma berish")}</ButtonLink>
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
