import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { formatUZS } from "@/lib/format";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { ResolveDispute } from "@/components/admin/AdminActions";

export const metadata = { title: "Admin: buyurtmalar" };

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
      <h1>Buyurtmalar</h1>
      <div className="mt-6 space-y-4">
        {orders.length === 0 ? (
          <EmptyState title="Hozircha buyurtmalar yoʻq" />
        ) : (
          orders.map((o) => (
            <Card key={o.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <ButtonLink href={`/orders/${o.id}`} variant="link" className="font-bold">{o.service.title}</ButtonLink>
                  <p className="mt-1 text-ink-soft">Mijoz: {o.client.name}. Ijodkor: {o.provider.name}.</p>
                  <p className="mt-1 font-bold">{o.agreedPrice ? formatUZS(o.agreedPrice) : "—"}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              {o.status === "DISPUTED" && (
                <Card tone="pomegranate" padding="sm" className="mt-4 space-y-3">
                  <p><strong>Nizo sababi:</strong> {reason.get(o.id) || "Koʻrsatilmagan"}</p>
                  <ResolveDispute orderId={o.id} />
                </Card>
              )}
            </Card>
          ))
        )}
      </div>
    </>
  );
}
