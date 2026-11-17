import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canBrowseCreators, getCurrentUser, ROLE_HOME } from "@/lib/auth";
import { tk, translator } from "@/i18n/dictionary";
import { localHref } from "@/i18n/paths";
import { getLocale } from "@/i18n/server";
import { categoryName, CITIES, labelFor } from "@/lib/constants";
import { getCategories, getFeaturedProviders } from "@/lib/publicCache";
import { buildFaq, faqJsonLd, homeDescription, homeTitle, ogDefaults, organizationJsonLd, pageAlternates, websiteJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { ProviderCard } from "@/components/ProviderCard";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { TestModeBadge } from "@/components/ui/TestModeBadge";

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
  [tk("Toʻlang"), tk("Pul ish qabul qilinmaguncha xavfsiz saqlanadi."), "escrow"],
  [tk("Qabul qiling"), tk("Videoni oling, kerak boʻlsa tuzatish soʻrang, soʻng qabul qilib sharh qoldiring.")],
] as const;
const STEP_COLORS = ["bg-cobalt text-on-accent", "bg-saffron text-night", "bg-turquoise text-night", "bg-pomegranate text-on-accent"];

const PROMISES = [
  { title: tk("Shartlar yozma"), text: tk("Narx, muddat va tuzatishlar yozma kelishiladi. Ikkala tomon qabul qilgan matn saqlanib qoladi."), tone: "cobalt", icon: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" },
  { title: tk("Pul himoyada"), escrow: true, text: tk("Toʻlov ish qabul qilinmaguncha ushlab turiladi, shundan keyingina ijodkorga oʻtadi."), tone: "turquoise", icon: "M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6zM9 12l2.2 2.2L15.5 10" },
  { title: tk("Haqiqiy sharhlar"), text: tk("Sharhni faqat buyurtmasi yakunlangan mijoz qoldira oladi."), tone: "saffron", icon: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" },
] as const;

/** Both columns of the hero feed need enough posters to loop without a visible gap. */
function cycle<T>(items: T[], min: number): T[] {
  return Array.from({ length: Math.max(min, items.length) }, (_, i) => items[i % items.length]!);
}

export default async function HomePage() {
  // The home page is the client's way in (a creator feed and a search). A creator who lands here, from the logo or an old link, goes to their cabinet.
  const viewer = await getCurrentUser();
  if (!canBrowseCreators(viewer)) redirect(ROLE_HOME.PROVIDER);
  const locale = await getLocale();
  const t = translator(locale);
  // The same for every visitor, so it comes from the short-lived data cache (src/lib/publicCache.ts), not from the database each time.
  const [pool, categories] = await Promise.all([getFeaturedProviders(), getCategories()]);
  const evens = pool.filter((_, i) => i % 2 === 0);
  const odds = pool.filter((_, i) => i % 2 === 1);
  // At least two posters per column, so the loop never shows the same creator twice in a row (unless there is only one).
  const colA = pool.length ? cycle(evens.length ? evens : pool, 2) : [];
  const colB = pool.length ? cycle(odds.length ? odds : pool, 2) : [];
  const faq = buildFaq(categories.map((c) => categoryName(locale, c)), CITIES, locale);

  return (
    <>
      <JsonLd data={organizationJsonLd(undefined, locale)} />
      <JsonLd data={websiteJsonLd(undefined, locale)} />
      <JsonLd data={faqJsonLd(faq, locale)} />
      <section className="overflow-hidden border-b border-line">
        <Container pad="none" className="grid gap-14 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
          <div>
            <h1 className="animate-rise text-display">{t("Ijodkorni shu yerdan toping.")}</h1>
            <p className="mt-5 max-w-xl animate-rise text-lg text-ink-soft [animation-delay:120ms]">
              {t("Mobilograf, fotograf va montajchilarni solishtiring, shartlarni yozma kelishib oling. Pul ish qabul qilinmaguncha ijodkorga oʻtmaydi.")} <TestModeBadge />
            </p>
            <form action={localHref(locale, "/search")} method="get" className="mt-8 animate-rise [animation-delay:240ms]">
              {/* One command card: what on top, then where and go. The card draws the border and shows focus for the controls inside it. */}
              <div className="rounded-hero border border-line-strong bg-surface p-2 shadow-lift transition-[border-color,box-shadow] duration-200 ease-snap focus-within:border-cobalt focus-within:shadow-[0_0_0_3px_rgb(var(--c-cobalt)/0.35)]">
                <Field big bare hideLabel label={t("Sizga nima kerak?")} name="q" placeholder={t("Toʻy videosi, reel, kafe reklamasi…")} />
                <div className="mt-1 flex items-center gap-2 border-t border-line pt-1">
                  <div className="min-w-0 flex-1">
                    <Field big bare as="select" hideLabel label={t("Shahar")} name="city" defaultValue="">
                      <option value="">{t("Barcha shaharlar")}</option>
                      {CITIES.map((c) => <option key={c} value={c}>{labelFor(locale, c)}</option>)}
                    </Field>
                  </div>
                  <Button type="submit" size="lg" className="h-14 shrink-0 px-8">{t("Qidirish")}</Button>
                </div>
              </div>
            </form>
            <div className="mt-6 flex animate-rise flex-wrap gap-2 [animation-delay:340ms]">
              {categories.map((c) => (
                <ButtonLink key={c.slug} href={localHref(locale, `/search?category=${c.slug}`)} variant="chip">{categoryName(locale, c)}</ButtonLink>
              ))}
            </div>
          </div>

          {/* The one bold moment: a live feed of creators, two columns drifting in opposite directions. */}
          {pool.length > 0 && (
            <div aria-hidden="true" className="relative mx-auto w-full max-w-md animate-rise [animation-delay:200ms] lg:max-w-none">
              {/* A soft warm and cool glow behind the feed, instead of a hard decorative tile. */}
              <div className="absolute -inset-8 rounded-hero bg-gradient-to-br from-cobalt/25 via-transparent to-saffron/20 blur-3xl" />
              <div className="relative rounded-hero border border-line-strong bg-surface/70 shadow-lift-lg backdrop-blur-sm">
                <div className="marquee grid h-[26rem] grid-cols-2 gap-3 overflow-hidden rounded-hero p-3 [mask-image:linear-gradient(to_bottom,transparent,#000_9%,#000_91%,transparent)] lg:h-[34rem]">
                  <div className="marquee-col animate-drift-up [&>*]:mb-3">
                    {[...colA, ...colA].map((p, i) => <ProviderCard key={`a${i}-${p.id}`} p={p} variant="poster" />)}
                  </div>
                  <div className="marquee-col animate-drift-down [&>*]:mb-3" style={{ animationDelay: "-22s" }}>
                    {[...colB, ...colB].map((p, i) => <ProviderCard key={`b${i}-${p.id}`} p={p} variant="poster" />)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Container>
      </section>

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

      <section className="border-y border-line bg-surface">
        <Container pad="section">
          <h2>{t("Buyurtma qanday ishlaydi")}</h2>
          <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map(([title, text, promise], i) => (
              <li key={title} className="relative">
                {i < STEPS.length - 1 && <span aria-hidden="true" className="absolute left-16 top-7 -right-6 hidden border-t border-dashed border-line-strong lg:block" />}
                <span className={`relative grid h-14 w-14 place-items-center rounded-full font-display text-xl font-bold shadow-lift-sm ${STEP_COLORS[i]}`}>{i + 1}</span>
                <h3 className="mt-4 text-xl">{t(title)}</h3>
                <p className="mt-1.5 text-ink-soft">{t(text)} {promise === "escrow" && <TestModeBadge />}</p>
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
              <p className="mt-1.5 text-ink-soft">{t(x.text)} {"escrow" in x && <TestModeBadge />}</p>
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
