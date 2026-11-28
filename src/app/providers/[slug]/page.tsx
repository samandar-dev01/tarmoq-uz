import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { translator } from "@/i18n/dictionary";
import { getLocale } from "@/i18n/server";
import { canBrowseCreators, getCurrentUser } from "@/lib/auth";
import { categoryName, labelFor } from "@/lib/constants";
import { formatDay, formatUZS, shortName } from "@/lib/format";
import { PROFILE_STATUS_LABEL } from "@/lib/orderUi";
import { formatPriceFrom } from "@/lib/publicFormat";
import { breadcrumbJsonLd, creatorJsonLd, ogDefaults, pageAlternates } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { PackageCompare } from "@/components/PackageCompare";
import { avatarUrl } from "@/lib/avatar";
import { RememberCreator } from "@/components/RememberCreator";
import { ReviewReply } from "@/components/ReviewReply";
import { LEVEL_LABEL, sellerLevel } from "@/lib/levels";
import { isOnline, usualResponseHours } from "@/lib/presence";
import { readQa } from "@/lib/serviceDetails";
import { Alert } from "@/components/ui/Alert";
import { Avatar, coverArt } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card, cardClasses, tagClasses } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stars } from "@/components/ui/Stars";

type Props = { params: Promise<{ slug: string }> };

/**
 * The profile with everything the page shows. `cache` shares ONE query between `generateMetadata` and the page of the
 * same request (they used to run it twice). Callers decide who may see the result; this only loads it.
 */
const getProfile = cache((slug: string) =>
  prisma.providerProfile.findUnique({
    where: { slug },
    include: {
      user: { select: { id: true, name: true, isActive: true, createdAt: true, avatarUpdatedAt: true, lastSeenAt: true } },
      category: { select: { name: true, nameRu: true } },
      services: { where: { isActive: true }, orderBy: { price: "asc" } },
      portfolio: { orderBy: { sortOrder: "asc" } },
    },
  }),
);

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const locale = await getLocale();
  const t = translator(locale);
  // A creator is sent away from this page; even the title it would have carried (a name, a headline) stays out of the response.
  if (!canBrowseCreators(await getCurrentUser())) return { title: t("Ijodkor profili"), robots: { index: false, follow: false } };
  const p = await getProfile(params.slug);
  // A page that is not public (unknown, or shown only to its owner or an admin as a preview) must never be indexed.
  if (!p || p.status !== "APPROVED") return { title: t("Ijodkor profili"), robots: { index: false, follow: false } };
  // The name and the headline are the creator's own words and stay as written in both languages; the address is this language's own.
  const alternates = pageAlternates(locale, `/providers/${params.slug}`);
  return {
    title: p.user.name,
    description: p.headline,
    alternates,
    openGraph: { ...ogDefaults(locale), title: p.user.name, description: p.headline, url: alternates.canonical },
  };
}

export default async function ProviderPage(props: Props) {
  const params = await props.params;
  const locale = await getLocale();
  const t = translator(locale);
  const viewer = await getCurrentUser();
  // A creator sees their own public profile and no one else's. Decided before the lookup, so the answer is the same
  // for a profile that exists, one that is not approved and one that does not exist (no way to find out which are there).
  // The two lookups do not depend on each other, so a creator's check of "is this my own page" runs next to the profile load.
  const [own, profile] = await Promise.all([
    viewer && !canBrowseCreators(viewer)
      ? prisma.providerProfile.findUnique({ where: { userId: viewer.id }, select: { slug: true } })
      : null,
    getProfile(params.slug),
  ]);
  if (viewer && !canBrowseCreators(viewer) && own?.slug !== params.slug) redirect("/forbidden");
  if (!profile || !profile.user.isActive) notFound();

  const isOwner = viewer?.id === profile.userId;
  const isAdmin = viewer?.role === "ADMIN";
  // Only approved profiles are public; owner and admins may preview others.
  if (profile.status !== "APPROVED" && !isOwner && !isAdmin) notFound();

  const shownReviews = { providerUserId: profile.userId, isHidden: false };
  const [reviews, stars, talks, lastDelivery] = await Promise.all([
    prisma.review.findMany({ where: shownReviews, orderBy: { createdAt: "desc" }, take: 10, include: { author: { select: { name: true } } } }),
    prisma.review.groupBy({ by: ["rating"], where: shownReviews, _count: { _all: true } }),
    // For the usual answering time: the first messages of the latest conversations (never their text).
    prisma.conversation.findMany({
      where: { OR: [{ userAId: profile.userId }, { userBId: profile.userId }] },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { messages: { orderBy: { createdAt: "asc" }, take: 10, select: { senderId: true, createdAt: true } } },
    }),
    prisma.delivery.findFirst({ where: { order: { providerId: profile.userId } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  const responseHours = usualResponseHours(talks.map((c) => c.messages), profile.userId);
  const level = sellerLevel(profile);
  const starTotal = stars.reduce((n, s) => n + s._count._all, 0);
  // A visit by someone else is counted for the creator's statistics. A raw write, so the profile's "updated" date (which
  // the sitemap shows) does not move; not awaited and never allowed to break the page.
  if (profile.status === "APPROVED" && viewer?.id !== profile.userId && viewer?.role !== "ADMIN") {
    void prisma.$executeRaw`UPDATE "ProviderProfile" SET "viewCount" = "viewCount" + 1 WHERE id = ${profile.id}`.catch(() => {});
  }

  const orderHref = (serviceId: string) => {
    const target = `/orders/new?service=${serviceId}`;
    return viewer ? target : `/login?role=client&next=${encodeURIComponent(target)}`;
  };
  const canOrder = !viewer || viewer.role === "CLIENT";
  const approved = profile.status === "APPROVED";
  // What the creator wrote stays as written. Everything the site says, and the stored values it shows (city, category, languages), is in the reader's language.
  const city = labelFor(locale, profile.city);
  const category = categoryName(locale, profile.category);
  const languages = profile.languages.map((l) => labelFor(locale, l));
  // The preview note has the status in bold in the middle of the sentence: the sentence is translated whole, split at the status.
  const [noteBefore = "", noteAfter = ""] = t("Koʻrib chiqish rejimi. Bu profil hozir {status} holatida va ommaga koʻrinmaydi.", { status: "\u0000" }).split("\u0000");

  return (
    <Container size="xl">
      {/* Remembered for the home page's "seen lately" row (public profiles only, not one's own). */}
      {approved && !isOwner && <RememberCreator slug={profile.slug} />}
      {/* Only a public (approved) profile carries structured data. The rating is included only when real reviews are shown below. */}
      {approved && (
        <>
          <JsonLd
            data={creatorJsonLd({
              slug: profile.slug,
              name: profile.user.name,
              headline: profile.headline,
              bio: profile.bio,
              city,
              category,
              languages,
              services: profile.services.map((s) => ({ title: s.title, description: s.description, price: s.price })),
              ratingAvg: profile.ratingAvg,
              ratingCount: profile.ratingCount,
              visibleReviews: reviews.length,
            }, undefined, locale)}
          />
          <JsonLd
            data={breadcrumbJsonLd([
              { name: t("Bosh sahifa"), path: "/" },
              { name: t("Ijodkorlarni toping"), path: "/search" },
              { name: profile.user.name, path: `/providers/${profile.slug}` },
            ], undefined, locale)}
          />
        </>
      )}
      {!approved && (
        <div className="mb-6">
          <Alert variant="info">
            {noteBefore}<strong>{t(PROFILE_STATUS_LABEL[profile.status]).toLowerCase()}</strong>{noteAfter}
          </Alert>
        </div>
      )}

      <Card padding="none" radius="hero" className="overflow-hidden">
        <div className="relative h-32 overflow-hidden border-b border-line sm:h-44">
          <div className="ikat absolute -inset-6" style={{ background: coverArt(profile.slug) }} />
        </div>
        <div className="px-5 pb-7 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <Avatar name={profile.user.name} src={avatarUrl(profile.user)} size="xl" className="-mt-12 ring-4 ring-surface" />
            <div className="flex gap-2 pt-4">
              {isOwner ? (
                <ButtonLink href="/dashboard/provider/profile/wizard" variant="secondary">{t("Profilni tahrirlash")}</ButtonLink>
              ) : canOrder && approved ? (
                <ButtonLink
                  href={viewer ? `/messages/new?to=${profile.userId}` : `/login?role=client&next=${encodeURIComponent(`/messages/new?to=${profile.userId}`)}`}
                  variant="secondary"
                >
                  {t("Xabar yozish")}
                </ButtonLink>
              ) : null}
            </div>
          </div>
          <h1 className="mt-4">{profile.user.name}</h1>
          <p className="mt-1.5 max-w-2xl text-lg text-ink-soft">{profile.headline}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={tagClasses("paper")}>
              {city}
              {profile.district ? `, ${profile.district}` : ""}
            </span>
            <span className={tagClasses("cobalt")}>{category}</span>
            {level > 0 && <span className={tagClasses("saffron")}>{t(LEVEL_LABEL[level as 1 | 2 | 3])}</span>}
            {profile.ratingCount > 0 ? (
              <Stars value={profile.ratingAvg} count={profile.ratingCount} className="ml-1" />
            ) : (
              <span className={tagClasses("saffron")}>{t("Yangi ijodkor")}</span>
            )}
          </div>
          {/* How active the creator is. */}
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${isOnline(profile.user.lastSeenAt) ? "bg-turquoise" : "bg-ink-mute/40"}`} />
              {isOnline(profile.user.lastSeenAt) ? t("Onlayn") : profile.user.lastSeenAt ? t("Oxirgi faollik: {when}", { when: formatDay(profile.user.lastSeenAt, locale) }) : t("Oflayn")}
            </li>
            {responseHours !== null && <li>{t("Odatda {hours} soat ichida javob beradi", { hours: responseHours })}</li>}
            {lastDelivery && <li>{t("Oxirgi topshiriq: {when}", { when: formatDay(lastDelivery.createdAt, locale) })}</li>}
            {profile.completedCount > 0 && <li>{t("{count} ta buyurtma bajarilgan", { count: profile.completedCount })}</li>}
          </ul>
        </div>
      </Card>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_19rem] lg:items-start">
        <div className="min-w-0 space-y-12">
          <section>
            <h2>{t("Ijodkor haqida")}</h2>
            <p className="mt-3 max-w-2xl whitespace-pre-line text-[1.0625rem] leading-7 text-ink-soft">{profile.bio}</p>
          </section>

          <section>
            <h2>{t("Paketlar")}</h2>
            {profile.services.length === 0 ? (
              <div className="mt-4"><EmptyState title={t("Hozircha paketlar yoʻq")} description={t("Bu ijodkor hali paket qoʻshmagan.")} /></div>
            ) : (
              <ul className="mt-4 space-y-4">
                {profile.services.map((s) => (
                  <li key={s.id} className={cardClasses({ padding: "none", className: "overflow-hidden sm:flex" })}>
                    <div className="min-w-0 flex-1 p-5">
                      <h3 className="text-lg">{s.title}</h3>
                      <p className="mt-1.5 text-ink-soft">{s.description}</p>
                      <p className="mt-3 flex flex-wrap gap-2">
                        <span className={tagClasses("paper")}>{t("{days} kunda topshiriladi", { days: s.deliveryDays })}</span>
                        <span className={tagClasses("paper")}>{t("{count} ta tuzatish", { count: s.revisions })}</span>
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-dashed border-saffron/30 bg-saffron-tint p-5 sm:w-56 sm:shrink-0 sm:flex-col sm:items-stretch sm:justify-center sm:border-l-2 sm:border-t-0">
                      <span className="text-xl font-extrabold tabular-nums tracking-tight">{formatUZS(s.price, locale)}</span>
                      {canOrder && approved && <ButtonLink href={orderHref(s.id)}>{t("Buyurtma berish")}</ButtonLink>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <PackageCompare packages={profile.services} orderHref={canOrder && approved ? orderHref : undefined} />

          {profile.services.some((s) => readQa(s.faq).length > 0) && (
            <section>
              <h2>{t("Koʻp beriladigan savollar")}</h2>
              {profile.services.filter((s) => readQa(s.faq).length > 0).map((s) => (
                <div key={s.id} className="mt-4">
                  <h3 data-user-content>{s.title}</h3>
                  <ul className="mt-2 space-y-2">
                    {readQa(s.faq).map((f, i) => (
                      <li key={i}>
                        <details className={cardClasses({ padding: "none" })}>
                          <summary data-user-content className="min-h-11 px-4 py-3 font-semibold">{f.question}</summary>
                          <p data-user-content className="whitespace-pre-line border-t border-line px-4 py-3 text-ink-soft">{f.answer}</p>
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}

          <section>
            <h2>{t("Portfolio")}</h2>
            {profile.portfolio.length === 0 ? (
              <div className="mt-4"><EmptyState title={t("Portfolioga hali ish qoʻshilmagan")} description={t("Ijodkor ishlarini qoʻshganda, ular shu yerda koʻrinadi.")} /></div>
            ) : (
              <ul className="mt-4 grid gap-5 sm:grid-cols-2">
                {profile.portfolio.map((item) => (
                  <li key={item.id} className={cardClasses({ padding: "none", className: "overflow-hidden" })}>
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="h-44 w-full border-b border-line object-cover" />
                    ) : (
                      <div className="relative h-44 overflow-hidden border-b border-line" aria-hidden="true">
                        <div className="ikat absolute -inset-4" style={{ background: coverArt(item.id) }} />
                      </div>
                    )}
                    <div className="p-4">
                      <p className="font-bold">{item.title}</p>
                      {item.videoUrl && (
                        <a href={item.videoUrl} target="_blank" rel="noopener noreferrer nofollow" className={`${buttonClasses({ variant: "link" })} mt-1 inline-block`}>
                          {t("Videoni koʻrish")}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>{t("Sharhlar")}</h2>
            {reviews.length === 0 ? (
              <div className="mt-4"><EmptyState title={t("Hali sharhlar yoʻq")} description={t("Sharhlar buyurtma yakunlangandan keyin shu yerda paydo boʻladi.")} /></div>
            ) : (
              <>
              {/* How the shown reviews spread over the five marks. */}
              <ul className="mt-4 max-w-sm space-y-1" aria-label={t("Baholar taqsimoti")}>
                {[5, 4, 3, 2, 1].map((mark) => {
                  const n = stars.find((s) => s.rating === mark)?._count._all ?? 0;
                  return (
                    <li key={mark} className="flex items-center gap-3 text-sm">
                      <span className="w-16 shrink-0 text-ink-soft">{t("{n} yulduz", { n: mark })}</span>
                      <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-paper-deep">
                        <span className="block h-full rounded-full bg-star" style={{ width: `${starTotal ? (n / starTotal) * 100 : 0}%` }} />
                      </span>
                      <span className="w-8 shrink-0 text-right tabular-nums">{n}</span>
                    </li>
                  );
                })}
              </ul>
              <ul className="mt-4 space-y-4">
                {reviews.map((r) => (
                  <li key={r.id} className={cardClasses({ padding: "md" })}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold">{shortName(r.author.name)}</span>
                      <Stars value={r.rating} />
                    </div>
                    <p className="mt-2 text-ink-soft">{r.comment}</p>
                    <p className="mt-2 text-sm text-ink-mute">{formatDay(r.createdAt, locale)}</p>
                    {r.reply ? (
                      <div className="mt-3 border-l-2 border-line-strong pl-3">
                        <p className="text-sm font-bold">{t("Ijodkor javobi")}</p>
                        <p data-user-content className="mt-1 whitespace-pre-line text-ink-soft">{r.reply}</p>
                      </div>
                    ) : (
                      isOwner && <ReviewReply reviewId={r.id} />
                    )}
                  </li>
                ))}
              </ul>
              </>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card>
            <h2 className="font-sans text-base tracking-normal">{t("Qisqacha")}</h2>
            <dl className="mt-3 space-y-3">
              {profile.equipment && (
                <div>
                  <dt className="text-sm font-semibold text-ink-soft">{t("Jihozlar")}</dt>
                  <dd className="mt-0.5">{profile.equipment}</dd>
                </div>
              )}
              {languages.length > 0 && (
                <div>
                  <dt className="text-sm font-semibold text-ink-soft">{t("Ish tillari")}</dt>
                  <dd className="mt-0.5">{languages.join(", ")}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-semibold text-ink-soft">{t("Boshlangʻich narx")}</dt>
                <dd className="mt-0.5 font-bold">{formatPriceFrom(profile.startingPrice, locale)}</dd>
              </div>
            </dl>
          </Card>
          <Card tone="turquoise">
            <h2 className="font-sans text-base tracking-normal">{t("Himoyalangan buyurtma")}</h2>
            <p className="mt-2 text-[0.9375rem]">{t("Shartlar yozma kelishiladi. Toʻlov siz ishni qabul qilmaguncha ushlab turiladi.")}</p>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
