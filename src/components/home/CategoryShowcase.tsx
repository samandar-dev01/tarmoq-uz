import Link from "next/link";
import { Photo } from "@/components/home/Photo";
import type { Locale } from "@/i18n/config";
import { localHref } from "@/i18n/paths";
import { CATALOG, catalogName } from "@/lib/catalog";
import { CATEGORY_PHOTOS } from "@/lib/homeImages";

/** The directions as large photographs: two across on a phone, four on a wide screen. Each opens its search. */
export function CategoryShowcase({ locale, label }: { locale: Locale; label: string }) {
  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-5 lg:grid-cols-4">
      {CATALOG.map((c) => {
        const photo = CATEGORY_PHOTOS[c.slug];
        return (
          <li key={c.slug}>
            <Link href={localHref(locale, `/search?category=${c.slug}`)} className="group block rounded-card">
              <span className="relative block aspect-[4/5] overflow-hidden rounded-card bg-media shadow-lift-sm transition-[transform,box-shadow] duration-300 ease-snap group-hover:-translate-y-1 group-hover:shadow-lift-lg">
                {photo && <Photo photo={photo} sizes="(min-width: 1024px) 270px, 50vw" className="transition-transform duration-700 ease-snap group-hover:scale-110 group-focus-visible:scale-110" />}
                {/* Shade under the name only, so it reads on any photograph and the picture stays clear. */}
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-media/85 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 block break-words p-3 text-base font-bold leading-tight text-on-accent sm:p-4 sm:font-display sm:text-lg">{catalogName(locale, c)}</span>
              </span>
              <span className="mt-2.5 line-clamp-2 px-1 text-xs leading-5 text-ink-soft sm:text-sm">{c.subcategories.map((s) => catalogName(locale, s)).join(", ")}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
