import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { PROFILE_STATUS_LABEL, PROFILE_STATUS_STYLE } from "@/lib/orderUi";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card, tagClasses } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProviderActions } from "@/components/admin/AdminActions";

export const metadata = { title: "Admin: ijodkorlar" };
const RANK: Record<string, number> = { PENDING_REVIEW: 0, SUSPENDED: 1, APPROVED: 2, DRAFT: 3 };

export default async function AdminProviders() {
  await requirePageRole("ADMIN");
  const profiles = await prisma.providerProfile.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, email: true } }, _count: { select: { services: { where: { isActive: true } }, portfolio: true } } },
  });
  profiles.sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9));

  return (
    <>
      <h1>Ijodkorlar</h1>
      <div className="mt-6 space-y-4">
        {profiles.length === 0 ? (
          <EmptyState title="Hozircha ijodkor profillari yoʻq" />
        ) : (
          profiles.map((p) => (
            <Card key={p.id} data-testid="provider-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">{p.user.name}</p>
                  <p className="text-sm text-ink-soft">{p.user.email}</p>
                  <p className="mt-2">{p.headline}</p>
                  <p className="mt-2 flex flex-wrap gap-2">
                    <span className={tagClasses("paper")}>{p.city}</span>
                    <span className={tagClasses("paper")}>{p._count.services} ta paket</span>
                    <span className={tagClasses("paper")}>{p._count.portfolio} ta portfolio ishi</span>
                  </p>
                  <ButtonLink href={`/providers/${p.slug}`} variant="link" className="mt-2 inline-block text-sm">Profilni koʻrish</ButtonLink>
                </div>
                <span
                  className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-bold ${PROFILE_STATUS_STYLE[p.status]}`}
                  data-testid="profile-status"
                  data-status={p.status}
                >
                  {PROFILE_STATUS_LABEL[p.status]}
                </span>
              </div>
              <div className="mt-4"><ProviderActions id={p.id} status={p.status} /></div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
