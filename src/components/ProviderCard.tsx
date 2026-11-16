import Link from "next/link";
import { translator } from "@/i18n/dictionary";
import { getLocale } from "@/i18n/server";
import { categoryName, labelFor } from "@/lib/constants";
import { formatPriceFrom } from "@/lib/publicFormat";
import type { ProviderCardData } from "@/lib/providers";
import { providerHref } from "@/lib/searchLinks";
import { Avatar, coverArt } from "@/components/ui/Avatar";
import { cardClasses, tagClasses } from "@/components/ui/Card";
import { Stars } from "@/components/ui/Stars";
import { PROFILE_STATUS_LABEL } from "@/lib/orderUi";

/**
 * A creator as a card (search results, home grid), or as a vertical "poster" for the home hero feed.
 * Posters are decorative and mouse-only (the hero feed is hidden from assistive tech and the tab order);
 * the grid below it is the accessible list.
 */
export async function ProviderCard({ p, variant = "card" }: { p: ProviderCardData; variant?: "card" | "poster" }) {
  const locale = await getLocale();
  const t = translator(locale);
  const href = providerHref(locale, p.slug);
  const category = categoryName(locale, p.category);
  if (variant === "poster") {
    return (
      <Link
        href={href}
        tabIndex={-1}
        className="group relative block aspect-[9/14] overflow-hidden rounded-hero border border-line-strong bg-surface shadow-lift transition-[transform,box-shadow] duration-200 ease-snap hover:-translate-y-1 hover:shadow-lift-lg"
      >
        <span className="ikat absolute -inset-5" style={{ background: coverArt(p.slug) }} />
        {/* Cinema grade: the art fades into the ground at the bottom, so the name plate always reads. */}
        <span className="absolute inset-0 bg-gradient-to-t from-paper/80 via-transparent to-paper/10" />
        <span className="absolute left-1/2 top-[42%] grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-paper/50 backdrop-blur-md transition-transform duration-200 ease-snap group-hover:scale-110">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="rgb(var(--c-ink))" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </span>
        <span className="absolute inset-x-3 bottom-3 block rounded-card border border-line-strong bg-paper/70 px-3 py-2.5 backdrop-blur-md">
          <span className="block truncate font-display text-sm font-semibold">{p.user.name}</span>
          <span className="block truncate text-xs text-ink-soft">{category}</span>
        </span>
      </Link>
    );
  }

  return (
    <Link href={href} className={cardClasses({ interactive: true, padding: "none", className: "group flex flex-col overflow-hidden" })}>
      <span className="relative block h-28 overflow-hidden border-b border-line">
        <span className="ikat absolute -inset-4 transition-transform duration-300 ease-snap group-hover:scale-105" style={{ background: coverArt(p.slug) }} />
        <span className="absolute inset-0 bg-gradient-to-t from-surface/70 to-transparent" />
        {/* Search lists only approved profiles, so every card can say so. */}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-turquoise/40 bg-paper/70 py-0.5 pl-1.5 pr-2.5 text-xs font-semibold text-turquoise-deep backdrop-blur-md">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
          {t(PROFILE_STATUS_LABEL.APPROVED)}
        </span>
        {p.ratingCount === 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-saffron px-3 py-0.5 text-xs font-bold text-night">{t("Yangi")}</span>
        )}
      </span>
      <span className="flex flex-1 flex-col px-5 pb-5">
        <Avatar name={p.user.name} size="lg" className="-mt-8 ring-4 ring-surface" />
        <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">{p.user.name}</h3>
        <span className="mt-2 flex flex-wrap gap-1.5">
          <span className={tagClasses("paper")}>
            {labelFor(locale, p.city)}
            {p.district ? `, ${p.district}` : ""}
          </span>
          <span className={tagClasses("cobalt")}>{category}</span>
        </span>
        <span className="mb-4 mt-3 line-clamp-2 text-[0.9375rem] text-ink-soft">{p.headline}</span>
        <span className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1 border-t border-dashed border-line-strong pt-4">
          {p.ratingCount > 0 ? <Stars value={p.ratingAvg} count={p.ratingCount} /> : <span className="whitespace-nowrap text-sm text-ink-mute">{t("Hali sharhlar yoʻq")}</span>}
          <span className="whitespace-nowrap font-bold">{formatPriceFrom(p.startingPrice, locale)}</span>
        </span>
      </span>
    </Link>
  );
}
