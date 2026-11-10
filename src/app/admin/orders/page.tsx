import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { formatUZS } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { ResolveDispute } from "@/components/admin/AdminActions";

export const metadata = { title: "Admin · Orders" };

export default async function AdminOrders() {
  await requirePageRole("ADMIN");
  const orders = await prisma.order.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { service: { select: { title: true } }, client: { select: { name: true } }, provider: { select: { name: true } } },
  });
  orders.sort((a, b) => Number(b.status === "DISPUTED") - Number(a.status === "DISPUTED"));

  const disputeIds = orders.filter((o) => o.status === "DISPUTED").map((o) => o.id);
  const logs = disputeIds.length
    ? await prisma.auditLog.findMany({ where: { action: "ORDER_DISPUTED", entityId: { in: disputeIds } }, orderBy: { createdAt: "desc" } })
    : [];
  const reason = new Map<string, string>();
  for (const l of logs) if (!reason.has(l.entityId)) reason.set(l.entityId, String((l.meta as { reason?: string } | null)?.reason ?? ""));

  return (
    <>
      <h1 className="text-2xl font-bold">Orders</h1>
      <div className="mt-4 space-y-3">
        {orders.length === 0 ? (
          <EmptyState title="No orders yet" />
        ) : (
          orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/orders/${o.id}`} className="font-semibold text-indigo-700 hover:underline">{o.service.title}</Link>
                  <p className="text-sm text-slate-600">{o.client.name} → {o.provider.name} · {o.agreedPrice ? formatUZS(o.agreedPrice) : "—"}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              {o.status === "DISPUTED" && (
                <div className="mt-3 space-y-3 rounded-lg bg-red-50 p-3">
                  <p className="text-sm text-red-900"><strong>Dispute reason:</strong> {reason.get(o.id) || "Not provided"}</p>
                  <ResolveDispute orderId={o.id} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
