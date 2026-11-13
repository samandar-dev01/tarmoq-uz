import { prisma } from "@/lib/db";
import { CITIES } from "@/lib/constants";
import { parseSearch, searchProviders } from "@/lib/providers";
import { ProviderCard } from "@/components/ProviderCard";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { TestModeBadge } from "@/components/ui/TestModeBadge";

export const dynamic = "force-dynamic";

// A real sequence, so these are numbered.
const STEPS = [
  ["Toping", "Shahar, yoʻnalish va byudjet boʻyicha ijodkorlarni qidiring."],
  ["Kelishing", "Topshiriqni yuboring, narx va muddatni kelishing. Ikkala tomon shartlarni qabul qiladi."],
  ["Toʻlang", "Pul ish qabul qilinmaguncha xavfsiz saqlanadi.", "escrow"],
  ["Qabul qiling", "Videoni oling, kerak boʻlsa tuzatish soʻrang, soʻng qabul qilib sharh qoldiring."],
] as const;
const STEP_COLORS = ["bg-cobalt text-white", "bg-saffron text-ink", "bg-turquoise text-ink", "bg-pomegranate text-white"];

const PROMISES = [
  { title: "Shartlar yozma", text: "Narx, muddat va tuzatishlar yozma kelishiladi. Ikkala tomon qabul qilgan matn saqlanib qoladi.", tone: "cobalt", icon: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" },
  { title: "Pul himoyada", escrow: true, text: "Toʻlov ish qabul qilinmaguncha ushlab turiladi, shundan keyingina ijodkorga oʻtadi.", tone: "turquoise", icon: "M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6zM9 12l2.2 2.2L15.5 10" },
  { title: "Haqiqiy sharhlar", text: "Sharhni faqat buyurtmasi yakunlangan mijoz qoldira oladi.", tone: "saffron", icon: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" },
] as const;

/** Both columns of the hero feed need enough posters to loop without a visible gap. */
function cycle<T>(items: T[], min: number): T[] {
  return Array.from({ length: Math.max(min, items.length) }, (_, i) => items[i % items.length]!);
}

export default async function HomePage() {
  const [featured, categories] = await Promise.all([
    searchProviders(parseSearch({ sort: "rating" }), 6),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);

  const pool = featured.items;
  const evens = pool.filter((_, i) => i % 2 === 0);
  const odds = pool.filter((_, i) => i % 2 === 1);
  // At least two posters per column, so the loop never shows the same creator twice in a row (unless there is only one).
  const colA = pool.length ? cycle(evens.length ? evens : pool, 2) : [];
  const colB = pool.length ? cycle(odds.length ? odds : pool, 2) : [];

  return (
    <>
      <section className="overflow-hidden border-b-2 border-ink">
        <Container pad="none" className="grid gap-12 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-16">
          <div>
            <h1 className="animate-rise text-display">Ijodkorni shu yerdan toping.</h1>
            <p className="mt-5 max-w-xl animate-rise text-lg text-ink-soft [animation-delay:120ms]">
              Mobilograf, fotograf va montajchilarni solishtiring, shartlarni yozma kelishib oling. Pul ish qabul qilinmaguncha ijodkorga oʻtmaydi. <TestModeBadge />
            </p>
            <form action="/search" method="get" className="mt-8 grid animate-rise gap-3 [animation-delay:240ms] sm:grid-cols-[1fr_auto]">
              <div className="sm:col-span-2">
                <Field big hideLabel label="Sizga nima kerak?" name="q" placeholder="Toʻy videosi, reel, kafe reklamasi…" />
              </div>
              <Field big as="select" hideLabel label="Shahar" name="city" defaultValue="">
                <option value="">Barcha shaharlar</option>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Field>
              <Button type="submit" size="lg" className="h-14">Qidirish</Button>
            </form>
            <div className="mt-6 flex animate-rise flex-wrap gap-2 [animation-delay:340ms]">
              {categories.map((c) => (
                <ButtonLink key={c.slug} href={`/search?category=${c.slug}`} variant="chip">{c.name}</ButtonLink>
              ))}
            </div>
          </div>

          {/* The one bold moment: a live feed of creators, two columns drifting in opposite directions. */}
          {pool.length > 0 && (
            <div aria-hidden="true" className="relative mx-auto w-full max-w-md animate-rise [animation-delay:200ms] lg:max-w-none">
              <div className="absolute -left-3 -top-3 h-20 w-20 rotate-12 rounded-card border-2 border-ink bg-turquoise" />
              <div className="relative rounded-hero border-2 border-ink bg-saffron shadow-pop-lg">
                <div className="marquee grid h-[26rem] grid-cols-2 gap-3 overflow-hidden rounded-[1.5rem] p-3 [mask-image:linear-gradient(to_bottom,transparent,#000_9%,#000_91%,transparent)] lg:h-[34rem]">
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
          <h2>Top ijodkorlar</h2>
          <ButtonLink href="/search" variant="link">Hammasini koʻrish</ButtonLink>
        </div>
        {featured.items.length === 0 ? (
          <EmptyState
            title="Hozircha ijodkorlar yoʻq"
            description="Tasdiqlangan ijodkorlar tez orada shu yerda paydo boʻladi."
            action={<ButtonLink href="/register?role=provider">Ijodkor boʻlib qoʻshilish</ButtonLink>}
          />
        ) : (
          // Four across when the count divides by four, otherwise three, so the last row is never a lone card.
          <div className={`grid gap-5 sm:grid-cols-2 ${featured.items.length % 4 === 0 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {featured.items.map((p) => <ProviderCard key={p.id} p={p} />)}
          </div>
        )}
      </Container>

      <section className="border-y-2 border-ink bg-white">
        <Container pad="section">
          <h2>Buyurtma qanday ishlaydi</h2>
          <ol className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map(([title, text, promise], i) => (
              <li key={title} className="relative">
                {i < STEPS.length - 1 && <span aria-hidden="true" className="absolute left-16 top-7 -right-6 hidden border-t-2 border-dashed border-ink/40 lg:block" />}
                <span className={`relative grid h-14 w-14 place-items-center rounded-full border-2 border-ink font-display text-xl font-bold shadow-pop-sm ${STEP_COLORS[i]}`}>{i + 1}</span>
                <h3 className="mt-4 text-xl">{title}</h3>
                <p className="mt-1.5 text-ink-soft">{text} {promise === "escrow" && <TestModeBadge />}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <Container pad="section">
        <h2>Nega Tarmoq.uz?</h2>
        <ul className="mt-8 grid gap-5 md:grid-cols-3">
          {PROMISES.map((x) => (
            <Card as="li" key={x.title} tone={x.tone} padding="lg">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--c-ink))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={x.icon} />
              </svg>
              <h3 className="mt-4 text-xl">{x.title}</h3>
              <p className="mt-1.5 text-ink-soft">{x.text} {"escrow" in x && <TestModeBadge />}</p>
            </Card>
          ))}
        </ul>
      </Container>

      <Container pad="none" className="pb-4">
        <Card tone="ink" padding="lg" radius="hero" className="sm:flex sm:items-center sm:justify-between sm:gap-8">
          <div>
            <h2>Ijodkormisiz? Buyurtmalar sizni kutmoqda.</h2>
            <p className="mt-2 max-w-xl text-paper/80">Profil yarating, paketlaringizni joylang va mijozlardan buyurtma oling.</p>
          </div>
          <ButtonLink href="/register?role=provider" variant="accent" size="lg" className="mt-6 shrink-0 sm:mt-0">Ijodkor sifatida qoʻshilish</ButtonLink>
        </Card>
      </Container>
    </>
  );
}
