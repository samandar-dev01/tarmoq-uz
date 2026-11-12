import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDay, formatUZS, shortName } from "@/lib/format";
import { PROFILE_STATUS_LABEL } from "@/lib/orderUi";
import { Alert } from "@/components/ui/Alert";
import { Avatar, coverArt } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card, cardClasses, tagClasses } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stars } from "@/components/ui/Stars";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await prisma.providerProfile.findUnique({
    where: { slug: params.slug },
    select: { headline: true, status: true, user: { select: { name: true } } },
  });
  if (!p || p.status !== "APPROVED") return { title: "Ijodkor profili" };
  return { title: p.user.name, description: p.headline };
}

export default async function ProviderPage({ params }: Props) {
  const viewer = await getCurrentUser();
  const profile = await prisma.providerProfile.findUnique({
    where: { slug: params.slug },
    include: {
      user: { select: { id: true, name: true, isActive: true, createdAt: true } },
      category: true,
      services: { where: { isActive: true }, orderBy: { price: "asc" } },
      portfolio: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!profile || !profile.user.isActive) notFound();

  const isOwner = viewer?.id === profile.userId;
  const isAdmin = viewer?.role === "ADMIN";
  // Only approved profiles are public; owner and admins may preview others.
  if (profile.status !== "APPROVED" && !isOwner && !isAdmin) notFound();

  const reviews = await prisma.review.findMany({
    where: { providerUserId: profile.userId, isHidden: false },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { author: { select: { name: true } } },
  });

  const orderHref = (serviceId: string) => {
    const target = `/orders/new?service=${serviceId}`;
    return viewer ? target : `/login?role=client&next=${encodeURIComponent(target)}`;
  };
  const canOrder = !viewer || viewer.role === "CLIENT";
  const approved = profile.status === "APPROVED";

  return (
    <Container size="xl">
      {!approved && (
        <div className="mb-6">
          <Alert variant="info">
            Koʻrib chiqish rejimi. Bu profil hozir <strong>{PROFILE_STATUS_LABEL[profile.status].toLowerCase()}</strong> holatida va ommaga koʻrinmaydi.
          </Alert>
        </div>
      )}

      <Card padding="none" radius="hero" className="overflow-hidden">
        <div className="relative h-32 overflow-hidden border-b-2 border-ink sm:h-44">
          <div className="ikat absolute -inset-6" style={{ background: coverArt(profile.slug) }} />
        </div>
        <div className="px-5 pb-7 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <Avatar name={profile.user.name} seed={profile.slug} size="xl" className="-mt-12" />
            <div className="flex gap-2 pt-4">
              {isOwner ? (
                <ButtonLink href="/dashboard/provider/profile/wizard" variant="secondary">Profilni tahrirlash</ButtonLink>
              ) : canOrder && approved ? (
                <ButtonLink
                  href={viewer ? `/messages/new?to=${profile.userId}` : `/login?role=client&next=${encodeURIComponent(`/messages/new?to=${profile.userId}`)}`}
                  variant="secondary"
                >
                  Xabar yozish
                </ButtonLink>
              ) : null}
            </div>
          </div>
          <h1 className="mt-4">{profile.user.name}</h1>
          <p className="mt-1.5 max-w-2xl text-lg text-ink-soft">{profile.headline}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={tagClasses("paper")}>
              {profile.city}
              {profile.district ? `, ${profile.district}` : ""}
            </span>
            <span className={tagClasses("cobalt")}>{profile.category.name}</span>
            {profile.ratingCount > 0 ? (
              <Stars value={profile.ratingAvg} count={profile.ratingCount} className="ml-1" />
            ) : (
              <span className={tagClasses("saffron")}>Yangi ijodkor</span>
            )}
          </div>
        </div>
      </Card>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_19rem] lg:items-start">
        <div className="space-y-12">
          <section>
            <h2>Ijodkor haqida</h2>
            <p className="mt-3 max-w-2xl whitespace-pre-line text-[1.0625rem] leading-7 text-ink-soft">{profile.bio}</p>
          </section>

          <section>
            <h2>Paketlar</h2>
            {profile.services.length === 0 ? (
              <div className="mt-4"><EmptyState title="Hozircha paketlar yoʻq" description="Bu ijodkor hali paket qoʻshmagan." /></div>
            ) : (
              <ul className="mt-4 space-y-4">
                {profile.services.map((s) => (
                  <li key={s.id} className={cardClasses({ padding: "none", className: "overflow-hidden sm:flex" })}>
                    <div className="min-w-0 flex-1 p-5">
                      <h3 className="text-lg">{s.title}</h3>
                      <p className="mt-1.5 text-ink-soft">{s.description}</p>
                      <p className="mt-3 flex flex-wrap gap-2">
                        <span className={tagClasses("paper")}>{s.deliveryDays} kunda topshiriladi</span>
                        <span className={tagClasses("paper")}>{s.revisions} ta tuzatish</span>
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t-2 border-dashed border-ink bg-saffron-tint p-5 sm:w-56 sm:shrink-0 sm:flex-col sm:items-stretch sm:justify-center sm:border-l-2 sm:border-t-0">
                      <span className="text-xl font-extrabold tabular-nums tracking-tight">{formatUZS(s.price)}</span>
                      {canOrder && approved && <ButtonLink href={orderHref(s.id)}>Buyurtma berish</ButtonLink>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>Portfolio</h2>
            {profile.portfolio.length === 0 ? (
              <div className="mt-4"><EmptyState title="Portfolioga hali ish qoʻshilmagan" description="Ijodkor ishlarini qoʻshganda, ular shu yerda koʻrinadi." /></div>
            ) : (
              <ul className="mt-4 grid gap-5 sm:grid-cols-2">
                {profile.portfolio.map((item) => (
                  <li key={item.id} className={cardClasses({ padding: "none", className: "overflow-hidden" })}>
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="h-44 w-full border-b-2 border-ink object-cover" />
                    ) : (
                      <div className="relative h-44 overflow-hidden border-b-2 border-ink" aria-hidden="true">
                        <div className="ikat absolute -inset-4" style={{ background: coverArt(item.id) }} />
                      </div>
                    )}
                    <div className="p-4">
                      <p className="font-bold">{item.title}</p>
                      {item.videoUrl && (
                        <a href={item.videoUrl} target="_blank" rel="noopener noreferrer nofollow" className={`${buttonClasses({ variant: "link" })} mt-1 inline-block`}>
                          Videoni koʻrish
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>Sharhlar</h2>
            {reviews.length === 0 ? (
              <div className="mt-4"><EmptyState title="Hali sharhlar yoʻq" description="Sharhlar buyurtma yakunlangandan keyin shu yerda paydo boʻladi." /></div>
            ) : (
              <ul className="mt-4 space-y-4">
                {reviews.map((r) => (
                  <li key={r.id} className={cardClasses({ padding: "md" })}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold">{shortName(r.author.name)}</span>
                      <Stars value={r.rating} />
                    </div>
                    <p className="mt-2 text-ink-soft">{r.comment}</p>
                    <p className="mt-2 text-sm text-ink-mute">{formatDay(r.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card>
            <h2 className="font-sans text-base tracking-normal">Qisqacha</h2>
            <dl className="mt-3 space-y-3">
              {profile.equipment && (
                <div>
                  <dt className="text-sm font-semibold text-ink-soft">Jihozlar</dt>
                  <dd className="mt-0.5">{profile.equipment}</dd>
                </div>
              )}
              {profile.languages.length > 0 && (
                <div>
                  <dt className="text-sm font-semibold text-ink-soft">Ish tillari</dt>
                  <dd className="mt-0.5">{profile.languages.join(", ")}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-semibold text-ink-soft">Boshlangʻich narx</dt>
                <dd className="mt-0.5 font-bold">{formatUZS(profile.startingPrice)}dan</dd>
              </div>
            </dl>
          </Card>
          <Card tone="turquoise">
            <h2 className="font-sans text-base tracking-normal">Himoyalangan buyurtma</h2>
            <p className="mt-2 text-[0.9375rem]">Shartlar yozma kelishiladi. Toʻlov siz ishni qabul qilmaguncha ushlab turiladi.</p>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
