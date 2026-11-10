import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReviewToggle } from "@/components/admin/AdminActions";

export const metadata = { title: "Admin · Reviews" };

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
      <h1 className="text-2xl font-bold">Reviews</h1>
      <div className="mt-4 space-y-3">
        {reviews.length === 0 ? (
          <EmptyState title="No reviews yet" description="Reviews appear here after clients rate completed orders." />
        ) : (
          reviews.map((r) => (
            <div key={r.id} className={`rounded-xl border p-4 ${r.isHidden ? "border-slate-200 bg-slate-100" : "border-slate-200 bg-white"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.author.name} → {providerName.get(r.providerUserId) ?? "Unknown"}</p>
                  <p className="text-amber-500" aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</p>
                  <p className="mt-1 text-sm text-slate-700">{r.comment}</p>
                  {r.isHidden && <p className="mt-1 text-xs text-slate-500">Hidden from the public</p>}
                </div>
                <ReviewToggle id={r.id} hidden={r.isHidden} />
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
