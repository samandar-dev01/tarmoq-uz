import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stars } from "@/components/ui/Stars";
import { ReviewToggle } from "@/components/admin/AdminActions";

export const metadata = { title: "Admin: sharhlar" };

export default async function AdminReviews() {
  await requirePageRole("ADMIN");
  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { author: { select: { name: true } } },
  });
  const providers = await prisma.user.findMany({ where: { id: { in: [...new Set(reviews.map((r) => r.providerUserId))] } }, select: { id: true, name: true } });
  const providerName = new Map(providers.map((p) => [p.id, p.name]));

  return (
    <>
      <h1>Sharhlar</h1>
      <div className="mt-6 space-y-4">
        {reviews.length === 0 ? (
          <EmptyState title="Hozircha sharhlar yoʻq" description="Mijozlar yakunlangan buyurtmalarni baholagach, sharhlar shu yerda paydo boʻladi." />
        ) : (
          reviews.map((r) => (
            <Card key={r.id} tone={r.isHidden ? "tint" : "white"}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">{r.author.name} haqida: {providerName.get(r.providerUserId) ?? "Nomaʼlum"}</p>
                  <div className="mt-1"><Stars value={r.rating} /></div>
                  <p className="mt-2 text-ink-soft">{r.comment}</p>
                  {r.isHidden && <p className="mt-2 text-sm text-ink-mute">Ommadan yashirilgan</p>}
                </div>
                <ReviewToggle id={r.id} hidden={r.isHidden} />
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
