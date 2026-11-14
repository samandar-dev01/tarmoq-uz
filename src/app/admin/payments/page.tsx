import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { formatMoment, formatUZS } from "@/lib/format";
import { orderReference } from "@/lib/payments/manualPure";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card, tagClasses } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmPayment } from "@/components/admin/AdminActions";

export const metadata = { title: "Admin: toʻlovlar" };
const LATE_AFTER_MS = 48 * 60 * 60 * 1000;

export default async function AdminPayments() {
  await requirePageRole("ADMIN");
  const payments = await prisma.payment.findMany({
    where: { status: "AWAITING_CONFIRMATION" },
    orderBy: { updatedAt: "asc" },
    take: 200,
    include: { order: { select: { id: true, service: { select: { title: true } }, client: { select: { name: true } }, provider: { select: { name: true } } } } },
  });
  const now = Date.now();

  return (
    <>
      <h1>Toʻlovlar</h1>
      <div className="mt-6 space-y-4">
        {payments.length === 0 ? (
          <EmptyState title="Hozircha tekshiriladigan toʻlovlar yoʻq" />
        ) : (
          payments.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <ButtonLink href={`/orders/${p.order.id}`} variant="link" className="font-bold">{p.order.service.title}</ButtonLink>
                  <p className="mt-1 text-ink-soft">Mijoz: {p.order.client.name}. Ijodkor: {p.order.provider.name}.</p>
                  <p className="mt-1 font-bold">{formatUZS(p.amount)}</p>
                  <p className="mt-2 flex flex-wrap gap-2">
                    <span className={tagClasses("saffron")}>Izoh kodi: {orderReference(p.order.id)}</span>
                    <span className={tagClasses("paper")}>{formatMoment(p.updatedAt)}</span>
                    {now - p.updatedAt.getTime() > LATE_AFTER_MS && <span className={tagClasses("pomegranate")}>48 soatdan oshdi</span>}
                  </p>
                  {p.receiptKey && (
                    <ButtonLink href={`/api/admin/payments/${p.id}/receipt`} target="_blank" rel="noopener noreferrer" prefetch={false} variant="link" className="mt-2 inline-block text-sm">
                      Chekni ochish
                    </ButtonLink>
                  )}
                </div>
                <span className={tagClasses("saffron")}>Tekshirilmoqda</span>
              </div>
              <div className="mt-4"><ConfirmPayment paymentId={p.id} amount={formatUZS(p.amount)} /></div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
