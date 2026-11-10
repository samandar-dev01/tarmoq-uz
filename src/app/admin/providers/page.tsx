import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProviderActions } from "@/components/admin/AdminActions";

export const metadata = { title: "Admin · Providers" };
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
      <h1 className="text-2xl font-bold">Providers</h1>
      <div className="mt-4 space-y-3">
        {profiles.length === 0 ? (
          <EmptyState title="No provider profiles yet" />
        ) : (
          profiles.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{p.user.name} <span className="font-normal text-slate-500">· {p.user.email}</span></p>
                  <p className="text-sm text-slate-600">{p.headline}</p>
                  <p className="mt-1 text-xs text-slate-500">{p.city} · {p._count.services} packages · {p._count.portfolio} portfolio items</p>
                  <Link href={`/providers/${p.slug}`} className="text-xs font-medium text-indigo-600 hover:underline">Preview profile</Link>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium" data-testid="profile-status">{p.status.replace("_", " ")}</span>
              </div>
              <div className="mt-3"><ProviderActions id={p.id} status={p.status} /></div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
