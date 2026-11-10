import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatUZS, initials, shortName } from "@/lib/format";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await prisma.providerProfile.findUnique({
    where: { slug: params.slug },
    select: { headline: true, status: true, user: { select: { name: true } } },
  });
  if (!p || p.status !== "APPROVED") return { title: "Creator profile" };
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
    return viewer ? target : `/login?next=${encodeURIComponent(target)}`;
  };
  const canOrder = !viewer || viewer.role === "CLIENT";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {profile.status !== "APPROVED" && (
        <div className="mb-4">
          <Alert variant="info">Preview only. This profile is <strong>{profile.status.replace("_", " ").toLowerCase()}</strong> and is not visible to the public.</Alert>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-indigo-100 text-2xl font-semibold text-indigo-700">
          {initials(profile.user.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{profile.user.name}</h1>
          <p className="mt-1 text-slate-700">{profile.headline}</p>
          <p className="mt-2 text-sm text-slate-500">
            {profile.city}{profile.district ? `, ${profile.district}` : ""} · {profile.category.name} ·{" "}
            {profile.ratingCount > 0 ? `★ ${profile.ratingAvg.toFixed(1)} (${profile.ratingCount} reviews)` : "No reviews yet"}
          </p>
        </div>
        <div className="flex gap-2">
          {isOwner ? (
            <Link href="/dashboard/provider/profile/wizard" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50">
              Edit profile
            </Link>
          ) : canOrder && profile.status === "APPROVED" ? (
            <Link
              href={viewer ? `/messages/new?to=${profile.userId}` : `/login?next=${encodeURIComponent(`/providers/${profile.slug}`)}`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
            >
              Message
            </Link>
          ) : null}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">About</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{profile.bio}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {profile.equipment && (
            <div><dt className="font-medium text-slate-500">Equipment</dt><dd>{profile.equipment}</dd></div>
          )}
          {profile.languages.length > 0 && (
            <div><dt className="font-medium text-slate-500">Languages</dt><dd>{profile.languages.join(", ")}</dd></div>
          )}
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Packages</h2>
        {profile.services.length === 0 ? (
          <div className="mt-3"><EmptyState title="No packages yet" description="This creator hasn’t listed any packages." /></div>
        ) : (
          <ul className="mt-3 space-y-3">
            {profile.services.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{s.description}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Delivery in {s.deliveryDays} {s.deliveryDays === 1 ? "day" : "days"} · {s.revisions} {s.revisions === 1 ? "revision" : "revisions"}
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                  <span className="text-lg font-bold">{formatUZS(s.price)}</span>
                  {canOrder && profile.status === "APPROVED" && (
                    <Link href={orderHref(s.id)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                      Order
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Portfolio</h2>
        {profile.portfolio.length === 0 ? (
          <div className="mt-3"><EmptyState title="No portfolio items yet" /></div>
        ) : (
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profile.portfolio.map((item) => (
              <li key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {item.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="h-40 w-full object-cover" />
                )}
                <div className="p-3">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.videoUrl && (
                    <a href={item.videoUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-block text-sm text-indigo-600 hover:underline">
                      Watch video ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Reviews</h2>
        {reviews.length === 0 ? (
          <div className="mt-3"><EmptyState title="No reviews yet" description="Reviews appear here after completed orders." /></div>
        ) : (
          <ul className="mt-3 space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{shortName(r.author.name)}</span>
                  <span className="text-amber-500" aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{r.comment}</p>
                <p className="mt-2 text-xs text-slate-400">{r.createdAt.toISOString().slice(0, 10)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
