import Link from "next/link";
import { Photo } from "@/components/home/Photo";
import { SearchBox } from "@/components/SearchBox";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { Field } from "@/components/ui/Field";
import { translator } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/config";
import { localHref } from "@/i18n/paths";
import { catalogName, findSubcategory } from "@/lib/catalog";
import { categoryName, CITIES, labelFor } from "@/lib/constants";
import { HERO_PHOTOS, type HomePhoto } from "@/lib/homeImages";

type Category = { slug: string; name: string; nameRu?: string | null };
type Tile = { photo: HomePhoto; href: string; label: string; shape: string; priority?: boolean; lazy?: boolean };

// How wide one collage column is: half the page on a phone, half of a 32 rem block on a tablet, a quarter on a wide screen.
const TILE_SIZES = "(min-width: 1024px) 270px, (min-width: 640px) 250px, 50vw";

/** One photograph of the collage: a way into the search it names. */
function CollageTile({ tile, delay }: { tile: Tile; delay: string }) {
  return (
    <Link href={tile.href} className={`group relative block animate-rise overflow-hidden rounded-card bg-paper-deep shadow-lift ${tile.shape} ${delay}`}>
      <Photo photo={tile.photo} sizes={TILE_SIZES} priority={tile.priority} lazy={tile.lazy} className="transition-transform duration-500 ease-snap group-hover:scale-105" />
      <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-media/65 px-3 py-1.5 text-xs font-semibold text-on-accent backdrop-blur-sm sm:bottom-3 sm:left-3">
        {tile.label}
      </span>
    </Link>
  );
}

/** The top of the home page: what the site is for and one search, beside a collage of the kinds of work. */
export function Hero({ locale, categories }: { locale: Locale; categories: Category[] }) {
  const t = translator(locale);
  const sub = (slug: string) => {
    const found = findSubcategory(slug)!;
    return { href: localHref(locale, `/search?sub=${slug}&category=${found.category.slug}`), label: catalogName(locale, found.subcategory) };
  };
  // Two columns of one tall and one wide picture each, in opposite order, the second set a little lower.
  const left: Tile[] = [
    { photo: HERO_PHOTOS.wedding, ...sub("wedding-photo"), shape: "aspect-[4/5]", priority: true },
    { photo: HERO_PHOTOS.filming, ...sub("business-ads"), shape: "aspect-[4/3]" },
  ];
  const right: Tile[] = [
    { photo: HERO_PHOTOS.samarkand, href: localHref(locale, "/search?city=Samarqand"), label: labelFor(locale, "Samarqand"), shape: "aspect-[4/3]", lazy: false },
    { photo: HERO_PHOTOS.cafe, ...sub("product-video"), shape: "aspect-[4/5]" },
  ];
  const examples = [
    t("Toʻyimiz uchun fotograf kerak…"),
    t("Kafem uchun kreativ video…"),
    t("Instagram uchun professional reel…"),
    t("Dron orqali suratga olish…"),
    t("Mahsulotlarim uchun fotosessiya…"),
  ];

  return (
    <section className="border-b border-line bg-warm">
      <Container pad="none" className="grid items-center gap-7 py-6 sm:gap-10 sm:py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14 lg:py-16">
        {/* Above the collage, so the search suggestions are never under a picture. */}
        <div className="relative z-20 min-w-0">
          {/* On a phone the line is left out, so the first photographs show without scrolling. */}
          <p className="hidden animate-rise items-center gap-2.5 text-sm font-bold text-cobalt-dark sm:flex">
            <span aria-hidden="true" className="h-0.5 w-8 shrink-0 rounded-full bg-cobalt" />
            {t("Oʻzbekiston ijodkorlari bir tarmoqda")}
          </p>
          <h1 className="animate-rise text-display [animation-delay:80ms] sm:mt-4">
            {t("Ijodingiz uchun kerakli inson")} <span className="text-cobalt">{t("shu yerda.")}</span>
          </h1>
          <p className="mt-3 max-w-xl animate-rise text-base text-ink-soft [animation-delay:160ms] sm:mt-5 sm:text-lg">
            {t("Eng yaxshi ijodkorlarni toping, xizmatlarni solishtiring va gʻoyalaringizni amalga oshiring.")}
          </p>
          <form action={localHref(locale, "/search")} method="get" className="relative z-20 mt-5 animate-rise [animation-delay:240ms] sm:mt-8">
            {/* One search block: what on the first row, where and go on the second. It shows focus for the controls inside it. */}
            <div className="rounded-hero border border-line-strong bg-surface p-2 shadow-lift-lg transition-[border-color,box-shadow] duration-200 ease-snap focus-within:border-cobalt focus-within:shadow-[0_0_0_4px_rgb(var(--c-cobalt)/0.25)]">
              <div className="flex items-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="ml-3 hidden shrink-0 text-cobalt-dark sm:block">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.8-3.8" />
                </svg>
                <div className="min-w-0 flex-1">
                  <SearchBox big bare hideLabel label={t("Sizga nima kerak?")} placeholder={t("Qanday ijodkor yoki xizmat izlayapsiz?")} examples={examples} />
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2 border-t border-line pt-2">
                <div className="min-w-0 flex-1">
                  <Field big bare as="select" hideLabel label={t("Shahar")} name="city" defaultValue="">
                    <option value="">{t("Barcha shaharlar")}</option>
                    {CITIES.map((c) => <option key={c} value={c}>{labelFor(locale, c)}</option>)}
                  </Field>
                </div>
                <Button type="submit" size="lg" className="h-14 shrink-0 sm:px-10">{t("Qidirish")}</Button>
              </div>
            </div>
          </form>
          {/* One row that slides on a phone (data-rail: it holds more than fits on purpose); on a wide screen the label sits above the pills. */}
          <div data-rail className="-mx-4 mt-3 flex animate-rise items-center gap-2 overflow-x-auto px-4 py-1.5 [animation-delay:320ms] sm:mx-0 sm:mt-4 sm:flex-wrap sm:overflow-visible sm:px-0">
            <span className="mr-1 shrink-0 text-sm font-bold lg:basis-full">{t("Ommabop:")}</span>
            {categories.map((c) => (
              <ButtonLink key={c.slug} href={localHref(locale, `/search?category=${c.slug}`)} variant="chip" className="shrink-0 lg:px-3">{categoryName(locale, c)}</ButtonLink>
            ))}
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-lg grid-cols-2 items-start gap-3 sm:gap-4 lg:max-w-none">
          <div className="grid gap-3 sm:gap-4">
            <CollageTile tile={left[0]!} delay="[animation-delay:120ms]" />
            <CollageTile tile={left[1]!} delay="[animation-delay:280ms]" />
          </div>
          <div className="mt-6 grid gap-3 sm:mt-10 sm:gap-4">
            <CollageTile tile={right[0]!} delay="[animation-delay:200ms]" />
            <CollageTile tile={right[1]!} delay="[animation-delay:360ms]" />
          </div>
        </div>
      </Container>
    </section>
  );
}
