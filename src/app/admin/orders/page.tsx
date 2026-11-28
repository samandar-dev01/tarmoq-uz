import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { formatUZS } from "@/lib/format";
import { manualPaymentsOn } from "@/lib/payments/mode";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { ResolveDispute } from "@/components/admin/AdminActions";

export const metadata = { title: "Admin: buyurtmalar" };

export default async function AdminOrders() {
  await requirePageRole("ADMIN");
  const manual = manualPaymentsOn();
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
  // A cancellation both sides agreed to arrives here too: it is not a quarrel, and the money goes back to the client.
  const agreed = new Map(
    disputeIds.length
      ? (await prisma.orderRequest.findMany({ where: { orderId: { in: disputeIds }, type: "CANCEL", status: "ACCEPTED" } })).map((r) => [r.orderId, r.reason])
      : [],
  );

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
                  {agreed.has(o.id) ? (
                    <>
                      <p><strong>Ikkala tomon bekor qilishga rozi boʻlgan.</strong> Pulni mijozga qaytaring.</p>
                      <p data-user-content><strong>Sababi:</strong> {agreed.get(o.id)}</p>
                    </>
                  ) : (
                    <p><strong>Nizo sababi:</strong> {reason.get(o.id) || "Koʻrsatilmagan"}</p>
                  )}
                  {manual && <Alert variant="warning">Qoʻlda toʻlov: <strong>Mijozga qaytarish</strong> tugmasini bosishdan oldin pulni mijozning kartasiga oʻzingiz yuboring.</Alert>}
                  <ResolveDispute orderId={o.id} refundOnly={agreed.has(o.id)} />
                </Card>
              )}
            </Card>
          ))
        )}
      </div>
    </>
  );
}
