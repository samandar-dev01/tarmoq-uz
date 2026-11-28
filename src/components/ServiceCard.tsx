import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { cardClasses } from "@/components/ui/Card";
import { CardPicture } from "@/components/ui/CardPicture";
import { CoverFallback } from "@/components/ui/CoverFallback";
import { SaveButton } from "@/components/SaveButton";
import { translator } from "@/i18n/dictionary";
import { getLocale } from "@/i18n/server";
import { avatarUrl } from "@/lib/avatar";
import { formatUZS } from "@/lib/format";
import { LEVEL_LABEL, sellerLevel } from "@/lib/levels";
import { isOnline } from "@/lib/presence";
import type { ServiceCardData } from "@/lib/providers";
import { providerHref } from "@/lib/searchLinks";
import { thumbnailOf } from "@/lib/thumbnail";

/** One package as a card: picture, who offers it, what it is, rating, time and price. The whole card opens the creator. */
export async function ServiceCard({ s, saved }: { s: ServiceCardData; saved: boolean }) {
  const locale = await getLocale();
  const t = translator(locale);
  const p = s.profile;
  const level = sellerLevel(p);
  const thumb = thumbnailOf(p.portfolio);
  return (
    // The heart is a button of its own beside the link, never inside it.
    <div className="relative flex w-full">
      <Link href={providerHref(locale, p.slug)} className={cardClasses({ interactive: true, padding: "none", className: "group flex w-full flex-col overflow-hidden" })}>
        <span className="relative block aspect-video overflow-hidden border-b border-line">
          <CoverFallback />
          {thumb.image && <CardPicture src={thumb.image} />}
          {thumb.video && (
            <span aria-hidden="true" className="absolute bottom-2 left-2 grid h-9 w-9 place-items-center rounded-full bg-media/60">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="rgb(var(--c-on-accent))">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col p-4">
          <span className="flex items-center gap-2">
            <Avatar name={p.user.name} src={avatarUrl(p.user)} size="sm" />
            <span className="min-w-0">
              <span data-user-content className="block truncate text-sm font-bold">{p.user.name}</span>
              <span className="block text-xs text-ink-soft">{level > 0 ? t(LEVEL_LABEL[level as 1 | 2 | 3]) : p.ratingCount === 0 ? t("Yangi ijodkor") : ""}</span>
            </span>
            {isOnline(p.user.lastSeenAt) && (
              <span className="ml-auto flex shrink-0 items-center gap-1 text-xs font-semibold text-turquoise-deep">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-turquoise" />
                {t("Onlayn")}
              </span>
            )}
          </span>
          <span data-user-content className="mt-3 line-clamp-2 block font-semibold">{s.title}</span>
          {p.ratingCount > 0 && (
            <span className="mt-2 flex items-center gap-1 text-sm">
              <span aria-hidden="true" className="text-star">★</span>
              <span className="font-bold tabular-nums">{p.ratingAvg.toFixed(1)}</span>
              <span className="text-ink-soft">({p.ratingCount})</span>
            </span>
          )}
          <span className="mt-auto flex items-end justify-between gap-2 border-t border-line pt-3">
            <span className="text-sm text-ink-soft">{t("{days} kunda topshiriladi", { days: s.deliveryDays })}</span>
            <span className="whitespace-nowrap text-lg font-extrabold tabular-nums">{formatUZS(s.price, locale)}</span>
          </span>
        </span>
      </Link>
      <span className="absolute right-2 top-2">
        <SaveButton id={s.id} title={s.title} saved={saved} />
      </span>
    </div>
  );
}
