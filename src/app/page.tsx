import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canBrowseCreators, getCurrentUser, ROLE_HOME } from "@/lib/auth";
import { tk, translator } from "@/i18n/dictionary";
import { localHref } from "@/i18n/paths";
import { getLocale } from "@/i18n/server";
import { categoryName, CITIES, labelFor } from "@/lib/constants";
import { getCategories, getFeaturedProviders, getFeaturedServices } from "@/lib/publicCache";
import { cookies } from "next/headers";
import Link from "next/link";
import { Rail } from "@/components/ui/Rail";
import { SearchBox } from "@/components/SearchBox";
import { CATALOG, catalogName } from "@/lib/catalog";
import { parseSaved, parseSeen, SAVED_COOKIE, SEEN_COOKIE } from "@/lib/recentPure";
import { recentlySeen, savedServices, suggestedFor } from "@/lib/suggest";
import { ServiceCard } from "@/components/ServiceCard";
import { buildFaq, faqJsonLd, homeDescription, homeTitle, ogDefaults, organizationJsonLd, pageAlternates, websiteJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { ProviderCard } from "@/components/ProviderCard";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card, cardClasses } from "@/components/ui/Card";
import { coverArt } from "@/components/ui/Avatar";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";

export const dynamic = "force-dynamic";

// The home page has its own title (without the "· Tarmoq.uz" tail, the name is already in it), description and address.
// In Russian it is `/ru` (self-canonical), and while Russian is on both languages name each other (hreflang).
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const title = homeTitle(locale);
  const description = homeDescription(locale);
  const alternates = pageAlternates(locale, "/");
  return {
    title: { absolute: title },
    description,
    alternates,
    openGraph: { ...ogDefaults(locale), title, description, url: alternates.canonical },
  };
}

// A real sequence, so these are numbered. The words are marked with tk(): they are translated where they are shown.
const STEPS = [
  [tk("Toping"), tk("Shahar, yoʻnalish va byudjet boʻyicha ijodkorlarni qidiring.")],
  [tk("Kelishing"), tk("Topshiriqni yuboring, narx va muddatni kelishing. Ikkala tomon shartlarni qabul qiladi.")],
  [tk("Toʻlang"), tk("Pul ish qabul qilinmaguncha xavfsiz saqlanadi.")],
  [tk("Qabul qiling"), tk("Videoni oling, kerak boʻlsa tuzatish soʻrang, soʻng qabul qilib sharh qoldiring.")],
] as const;
const STEP_COLORS = ["bg-cobalt text-on-accent", "bg-saffron text-night", "bg-turquoise text-night", "bg-pomegranate text-on-accent"];

const PROMISES = [
  { title: tk("Shartlar yozma"), text: tk("Narx, muddat va tuzatishlar yozma kelishiladi. Ikkala tomon qabul qilgan matn saqlanib qoladi."), tone: "cobalt", icon: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" },
  { title: tk("Pul himoyada"), text: tk("Toʻlov ish qabul qilinmaguncha ushlab turiladi, shundan keyingina ijodkorga oʻtadi."), tone: "turquoise", icon: "M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6zM9 12l2.2 2.2L15.5 10" },
  { title: tk("Haqiqiy sharhlar"), text: tk("Sharhni faqat buyurtmasi yakunlangan mijoz qoldira oladi."), tone: "saffron", icon: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" },
] as const;

export default async function HomePage() {
  // The home page is the client's way in (a creator feed and a search). A creator who lands here, from the logo or an old link, goes to their cabinet.
  const viewer = await getCurrentUser();
  if (!canBrowseCreators(viewer)) redirect(ROLE_HOME.PROVIDER);
  const locale = await getLocale();
  const t = translator(locale);
  // The same for every visitor, so it comes from the short-lived data cache (src/lib/publicCache.ts), not from the database each time.
  const [pool, categories, services] = await Promise.all([getFeaturedProviders(), getCategories(), getFeaturedServices()]);
  // The two rows that depend on who is looking are read per visit (never cached).
  const jar = await cookies();
  const savedIds = new Set(parseSaved(jar.get(SAVED_COOKIE)?.value));
  const [seen, suggested, saved] = await Promise.all([
    recentlySeen(parseSeen(jar.get(SEEN_COOKIE)?.value)),
    viewer?.role === "CLIENT" ? suggestedFor(viewer.id) : [],
    savedServices([...savedIds]),
  ]);
  const personal = [
    { title: t("Yaqinda koʻrganlaringiz"), list: seen },
    { title: t("Sizga mos ijodkorlar"), list: suggested },
  ].filter((row) => row.list.length > 0);
  const rail = { prevLabel: t("Oldingi"), nextLabel: t("Keyingi") };
  const faq = buildFaq(categories.map((c) => categoryName(locale, c)), CITIES, locale);

  return (
    <>
      <JsonLd data={organizationJsonLd(undefined, locale)} />
      <JsonLd data={websiteJsonLd(undefined, locale)} />
      <JsonLd data={faqJsonLd(faq, locale)} />
      {/* The banner: what the site is for, one search, and the popular directions. */}
      <Container pad="none" className="pt-4 sm:pt-6">
        <section className="relative rounded-hero bg-cobalt px-3 py-10 text-on-accent sm:px-10 sm:py-14 lg:px-16 lg:py-20">
          {/* The woven art of the creator covers, along the far side of a wide screen. */}
          <span aria-hidden="true" className="absolute inset-y-0 right-0 hidden w-1/5 overflow-hidden rounded-r-hero lg:block">
            <span className="ikat absolute -inset-6" style={{ background: coverArt("tarmoq") }} />
          </span>
          <div className="relative lg:max-w-[44rem]">
            <h1 className="animate-rise text-display">{t("Ijodkorni shu yerdan toping.")}</h1>
            <p className="mt-4 max-w-2xl animate-rise text-lg [animation-delay:120ms]">
              {t("Mobilograf, fotograf va montajchilarni solishtiring, shartlarni yozma kelishib oling. Pul ish qabul qilinmaguncha ijodkorga oʻtmaydi.")}
            </p>
            <form action={localHref(locale, "/search")} method="get" className="relative z-20 mt-8 animate-rise text-ink [animation-delay:240ms]">
              {/* One search bar: what, where and go. On a phone "what" takes the first row. The bar shows focus for the controls inside it. */}
              <div className="rounded-hero border border-line-strong bg-surface p-2 shadow-lift transition-[border-color,box-shadow] duration-200 ease-snap focus-within:shadow-[0_0_0_3px_rgb(var(--c-saffron))] md:flex md:items-center md:gap-2">
                <div className="min-w-0 md:flex-1">
                  <SearchBox big bare hideLabel label={t("Sizga nima kerak?")} placeholder={t("Toʻy videosi, reel, kafe reklamasi…")} />
                </div>
                <div className="mt-1 flex items-center gap-2 border-t border-line pt-1 md:mt-0 md:border-l md:border-t-0 md:pl-2 md:pt-0">
                  <div className="min-w-0 flex-1 md:w-52 md:flex-none">
                    <Field big bare as="select" hideLabel label={t("Shahar")} name="city" defaultValue="">
                      <option value="">{t("Barcha shaharlar")}</option>
                      {CITIES.map((c) => <option key={c} value={c}>{labelFor(locale, c)}</option>)}
                    </Field>
                  </div>
                  <Button type="submit" size="lg" className="h-14 shrink-0 sm:px-8">{t("Qidirish")}</Button>
                </div>
              </div>
            </form>
            <div className="mt-6 flex animate-rise flex-wrap items-center gap-2 [animation-delay:340ms]">
              <span className="mr-1 text-sm font-bold">{t("Ommabop:")}</span>
              {categories.map((c) => (
                <ButtonLink key={c.slug} href={localHref(locale, `/search?category=${c.slug}`)} variant="chip">{categoryName(locale, c)}</ButtonLink>
              ))}
            </div>
          </div>
        </section>
      </Container>

      {saved.length > 0 && (
        <Container pad="none" className="pt-12">
          <h2 className="mb-4">{t("Saqlanganlar")}</h2>
          <Rail label={t("Saqlanganlar")} {...rail}>
            {saved.map((s) => (
              <li key={s.id} className="flex w-72 shrink-0 snap-start"><ServiceCard s={s} saved /></li>
            ))}
          </Rail>
        </Container>
      )}

      {personal.map((row) => (
        <Container key={row.title} pad="none" className="pt-12">
          <h2 className="mb-4">{row.title}</h2>
          <Rail label={row.title} {...rail}>
            {row.list.map((p) => (
              <li key={p.id} className="flex w-72 shrink-0 snap-start [&>*]:w-full"><ProviderCard p={p} /></li>
            ))}
          </Rail>
        </Container>
      ))}

      <Container pad="none" className="pt-12">
        <h2 className="mb-4">{t("Yoʻnalishlar boʻyicha izlang")}</h2>
        <Rail label={t("Yoʻnalishlar boʻyicha izlang")} {...rail}>
          {CATALOG.map((c) => (
            <li key={c.slug} className="w-60 shrink-0 snap-start sm:w-[17rem]">
              <Link href={localHref(locale, `/search?category=${c.slug}`)} className={cardClasses({ interactive: true, padding: "none", className: "group flex h-full flex-col overflow-hidden" })}>
                <span aria-hidden="true" className="relative block h-36 overflow-hidden border-b border-line">
                  <span className="ikat absolute -inset-4 transition-transform duration-300 ease-snap group-hover:scale-105" style={{ background: coverArt(c.slug) }} />
                </span>
                <span className="block p-4">
                  <span className="block font-bold">{catalogName(locale, c)}</span>
                  <span className="mt-1 line-clamp-2 block text-sm text-ink-soft">{c.subcategories.map((s) => catalogName(locale, s)).join(", ")}</span>
                </span>
              </Link>
            </li>
          ))}
        </Rail>
      </Container>

      <Container pad="section">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2>{t("Top ijodkorlar")}</h2>
          <ButtonLink href={localHref(locale, "/search")} variant="link" className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap">{t("Hammasini koʻrish")}</ButtonLink>
        </div>
        {pool.length === 0 ? (
          <EmptyState
            title={t("Hozircha ijodkorlar yoʻq")}
            description={t("Tasdiqlangan ijodkorlar tez orada shu yerda paydo boʻladi.")}
            action={<ButtonLink href="/register?role=provider">{t("Ijodkor boʻlib qoʻshilish")}</ButtonLink>}
          />
        ) : (
          // Four across when the count divides by four, otherwise three, so the last row is never a lone card.
          <div className={`grid gap-5 sm:grid-cols-2 ${pool.length % 4 === 0 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {pool.map((p) => <ProviderCard key={p.id} p={p} />)}
          </div>
        )}
      </Container>

      {services.length > 0 && (
        <Container pad="none" className="pb-12">
          <h2 className="mb-4">{t("Ommabop paketlar")}</h2>
          <Rail label={t("Ommabop paketlar")} {...rail}>
            {services.map((s) => (
              <li key={s.id} className="flex w-72 shrink-0 snap-start"><ServiceCard s={s} saved={savedIds.has(s.id)} /></li>
            ))}
          </Rail>
        </Container>
      )}

      <section className="border-y border-line bg-surface">
        <Container pad="section">
          <h2>{t("Buyurtma qanday ishlaydi")}</h2>
          <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="relative">
                {i < STEPS.length - 1 && <span aria-hidden="true" className="absolute left-16 top-7 -right-6 hidden border-t border-dashed border-line-strong lg:block" />}
                <span className={`relative grid h-14 w-14 place-items-center rounded-full font-display text-xl font-bold shadow-lift-sm ${STEP_COLORS[i]}`}>{i + 1}</span>
                <h3 className="mt-4 text-xl">{t(title)}</h3>
                <p className="mt-1.5 text-ink-soft">{t(text)}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <Container pad="section">
        <h2>{t("Nega Tarmoq.uz?")}</h2>
        <ul className="mt-8 grid gap-5 md:grid-cols-3">
          {PROMISES.map((x) => (
            <Card as="li" key={x.title} tone={x.tone} padding="lg">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--c-ink))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={x.icon} />
              </svg>
              <h3 className="mt-4 text-xl">{t(x.title)}</h3>
              <p className="mt-1.5 text-ink-soft">{t(x.text)}</p>
            </Card>
          ))}
        </ul>
      </Container>

      {/* The same questions and answers go out as FAQPage data (faqJsonLd above): what search engines read is what is shown here. */}
      <Container pad="section">
        <h2>{t("Koʻp beriladigan savollar")}</h2>
        <ul className="mt-8 grid gap-5 md:grid-cols-2">
          {faq.map((f) => (
            <Card as="li" key={f.question} padding="lg">
              <h3 className="text-xl">{f.question}</h3>
              <p className="mt-1.5 text-ink-soft">{f.answer}</p>
            </Card>
          ))}
        </ul>
      </Container>

      <Container pad="none" className="pb-4">
        <Card tone="ink" padding="lg" radius="hero" className="sm:flex sm:items-center sm:justify-between sm:gap-8">
          <div>
            <h2>{t("Ijodkormisiz? Buyurtmalar sizni kutmoqda.")}</h2>
            <p className="mt-2 max-w-xl text-ink-soft">{t("Profil yarating, paketlaringizni joylang va mijozlardan buyurtma oling.")}</p>
          </div>
          <ButtonLink href="/register?role=provider" variant="accent" size="lg" className="mt-6 shrink-0 sm:mt-0">{t("Ijodkor sifatida qoʻshilish")}</ButtonLink>
        </Card>
      </Container>
    </>
  );
}
