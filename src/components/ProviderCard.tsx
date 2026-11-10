import Link from "next/link";
import { formatUZS } from "@/lib/format";
import type { ProviderCardData } from "@/lib/providers";
import { Avatar, coverArt } from "@/components/ui/Avatar";
import { cardClasses, tagClasses } from "@/components/ui/Card";
import { Stars } from "@/components/ui/Stars";

/**
 * A creator as a card (search results, home grid), or as a vertical "poster" for the home hero feed.
 * Posters are decorative and mouse-only (the hero feed is hidden from assistive tech and the tab order);
 * the grid below it is the accessible list.
 */
export function ProviderCard({ p, variant = "card" }: { p: ProviderCardData; variant?: "card" | "poster" }) {
  if (variant === "poster") {
    return (
      <Link
        href={`/providers/${p.slug}`}
        tabIndex={-1}
        className="group relative block aspect-[9/14] overflow-hidden rounded-hero border-2 border-ink bg-ink shadow-pop transition-transform duration-150 hover:-translate-y-1"
      >
        <span className="ikat absolute -inset-5" style={{ background: coverArt(p.slug) }} />
        <span className="absolute left-1/2 top-[42%] grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-ink bg-white shadow-pop-sm transition-transform duration-150 group-hover:scale-110">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="rgb(var(--c-ink))" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </span>
        <span className="absolute inset-x-3 bottom-3 block rounded-card border-2 border-ink bg-white px-3 py-2.5">
          <span className="block truncate font-display text-sm font-semibold">{p.user.name}</span>
          <span className="block truncate text-xs text-ink-soft">{p.category.name}</span>
        </span>
      </Link>
    );
  }

  return (
    <Link href={`/providers/${p.slug}`} className={cardClasses({ interactive: true, padding: "none", className: "flex flex-col overflow-hidden" })}>
      <span className="relative block h-24 overflow-hidden border-b-2 border-ink">
        <span className="ikat absolute -inset-4" style={{ background: coverArt(p.slug) }} />
        {p.ratingCount === 0 && (
          <span className="absolute right-3 top-3 -rotate-3 rounded-full border-2 border-ink bg-saffron px-3 py-0.5 text-xs font-bold">Yangi</span>
        )}
      </span>
      <span className="flex flex-1 flex-col px-5 pb-5">
        <Avatar name={p.user.name} seed={p.slug} size="lg" className="-mt-8" />
        <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">{p.user.name}</h3>
        <span className="mt-2 flex flex-wrap gap-1.5">
          <span className={tagClasses("paper")}>
            {p.city}
            {p.district ? `, ${p.district}` : ""}
          </span>
          <span className={tagClasses("cobalt")}>{p.category.name}</span>
        </span>
        <span className="mb-4 mt-3 line-clamp-2 text-[0.9375rem] text-ink-soft">{p.headline}</span>
        <span className="mt-auto flex items-end justify-between gap-3 border-t-2 border-dashed border-ink/25 pt-4">
          {p.ratingCount > 0 ? <Stars value={p.ratingAvg} count={p.ratingCount} /> : <span className="text-sm text-ink-mute">Hali sharhlar yoʻq</span>}
          <span className="font-bold">{formatUZS(p.startingPrice)}dan</span>
        </span>
      </span>
    </Link>
  );
}
