import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { formatUZS } from "@/lib/format";
import { nextAction } from "@/lib/orderUi";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatTile } from "@/components/ui/StatTile";
import { OrderList } from "@/components/orders/OrderList";

export const metadata = { title: "Ijodkor kabineti" };

export default async function ProviderDashboard() {
  const user = await requirePageRole("PROVIDER");
  const [profile, orders, earned, held] = await Promise.all([
    prisma.providerProfile.findUnique({ where: { userId: user.id }, select: { slug: true, status: true, ratingAvg: true, ratingCount: true } }),
    prisma.order.findMany({
      where: { providerId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { service: { select: { title: true } }, client: { select: { name: true } } },
    }),
    prisma.ledgerEntry.aggregate({ where: { type: "PROVIDER_PAYOUT", payment: { order: { providerId: user.id } } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "HELD", order: { providerId: user.id } }, _sum: { amount: true } }),
  ]);

  const requests = orders.filter((o) => o.status === "REQUESTED").length;
  const inProgress = orders.filter((o) => o.status === "IN_PROGRESS").length;

  return (
    <Container size="xl">
      <h1>Ijodkor kabineti</h1>

      <div className="mt-6">
        {!profile || profile.status === "DRAFT" ? (
          <Alert variant="info">
            Profilingiz hali yuborilmagan. Buyurtma olishni boshlash uchun{" "}
            <ButtonLink href="/dashboard/provider/profile/wizard" variant="link">profilni toʻldiring</ButtonLink>.
          </Alert>
        ) : profile.status === "PENDING_REVIEW" ? (
          <Alert variant="info">Profilingiz admin tasdigʻini kutmoqda. Tasdiqlangach, qidiruvda koʻrinasiz.</Alert>
        ) : profile.status === "SUSPENDED" ? (
          <Alert variant="error">Profilingiz toʻxtatilgan. Qoʻllab-quvvatlash xizmatiga murojaat qiling.</Alert>
        ) : (
          <Alert variant="success">
            Profilingiz faol.{" "}
            <ButtonLink href={`/providers/${profile.slug}`} variant="link">Ommaviy profilni koʻrish</ButtonLink>{" "}
            yoki{" "}
            <ButtonLink href="/dashboard/provider/profile/wizard" variant="link">tahrirlash</ButtonLink>.
          </Alert>
        )}
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Yangi soʻrovlar" value={requests} tone="saffron" />
        <StatTile label="Jarayonda" value={inProgress} />
        <StatTile label="Ushlab turilgan mablagʻ" value={formatUZS(held._sum.amount ?? 0)} compact />
        <StatTile label="Olingan daromad (komissiyasiz)" value={formatUZS(earned._sum.amount ?? 0)} tone="turquoise" compact />
      </dl>

      <h2 className="mb-4 mt-12">Buyurtmalar</h2>
      {orders.length === 0 ? (
        <EmptyState title="Hozircha buyurtmalar yoʻq" description="Mijoz paketlaringizdan birini buyurtma qilganda, u shu yerda koʻrinadi." />
      ) : (
        <OrderList
          rows={orders.map((o) => ({
            id: o.id, status: o.status, title: o.service.title, other: o.client.name,
            price: o.agreedPrice, updatedAt: o.updatedAt, action: nextAction(o.status, "provider"),
          }))}
        />
      )}
    </Container>
  );
}
