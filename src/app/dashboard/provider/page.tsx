import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { getLocale, getT } from "@/i18n/server";
import { formatUZS } from "@/lib/format";
import { nextAction } from "@/lib/orderUi";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatTile } from "@/components/ui/StatTile";
import { OrderList } from "@/components/orders/OrderList";
import { PayoutDetailsForm } from "@/components/dashboard/PayoutDetailsForm";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Ijodkor kabineti") };
}

export default async function ProviderDashboard() {
  const user = await requirePageRole("PROVIDER");
  const t = await getT();
  const locale = await getLocale();
  const [profile, orders, earned, held, owed] = await Promise.all([
    prisma.providerProfile.findUnique({
      where: { userId: user.id },
      select: { slug: true, status: true, ratingAvg: true, ratingCount: true, payoutHolder: true, payoutCardLast4: true },
    }),
    prisma.order.findMany({
      where: { providerId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { service: { select: { title: true } }, client: { select: { name: true } } },
    }),
    // "Received" counts only money that has really reached the creator: sandbox payments (no payout record) and paid-out payouts.
    prisma.ledgerEntry.aggregate({
      where: { type: "PROVIDER_PAYOUT", payment: { order: { providerId: user.id }, OR: [{ payout: { is: null } }, { payout: { status: "PAID" } }] } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({ where: { status: "HELD", order: { providerId: user.id } }, _sum: { amount: true } }),
    prisma.payout.aggregate({ where: { providerId: user.id, status: "PENDING" }, _sum: { amount: true } }),
  ]);
  const owedNow = owed._sum.amount ?? 0;

  const requests = orders.filter((o) => o.status === "REQUESTED").length;
  const inProgress = orders.filter((o) => o.status === "IN_PROGRESS").length;

  return (
    <Container size="xl">
      <h1>{t("Ijodkor kabineti")}</h1>

      <div className="mt-6">
        {!profile || profile.status === "DRAFT" ? (
          <Alert variant="info">
            {t("Profilingiz hali yuborilmagan. Buyurtma olishni boshlash uchun")}{" "}
            <ButtonLink href="/dashboard/provider/profile/wizard" variant="link">{t("profilni toʻldiring")}</ButtonLink>.
          </Alert>
        ) : profile.status === "PENDING_REVIEW" ? (
          <Alert variant="info">{t("Profilingiz admin tasdigʻini kutmoqda. Tasdiqlangach, qidiruvda koʻrinasiz.")}</Alert>
        ) : profile.status === "SUSPENDED" ? (
          <Alert variant="error">{t("Profilingiz toʻxtatilgan. Qoʻllab-quvvatlash xizmatiga murojaat qiling.")}</Alert>
        ) : (
          <Alert variant="success">
            {t("Profilingiz faol.")}{" "}
            <ButtonLink href={`/providers/${profile.slug}`} variant="link">{t("Ommaviy profilni koʻrish")}</ButtonLink>{" "}
            {t("yoki")}{" "}
            <ButtonLink href="/dashboard/provider/profile/wizard" variant="link">{t("tahrirlash")}</ButtonLink>.
          </Alert>
        )}
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t("Yangi soʻrovlar")} value={requests} tone="saffron" />
        <StatTile label={t("Jarayonda")} value={inProgress} />
        <StatTile label={t("Ushlab turilgan mablagʻ")} value={formatUZS(held._sum.amount ?? 0, locale)} compact />
        <StatTile label={t("Olingan daromad (komissiyasiz)")} value={formatUZS(earned._sum.amount ?? 0, locale)} tone="turquoise" compact />
      </dl>

      {profile && (
        <>
          <h2 className="mb-4 mt-12">{t("Pul olish")}</h2>
          <Card>
            <p className="mb-5 text-ink-soft">
              {t("Mijoz ishni qabul qilgach, daromadingiz (komissiyasiz) shu kartaga oʻtkaziladi.")}
              {owedNow > 0 && <> {t("Hozir oʻtkazilishi kutilayotgan:")} <strong>{formatUZS(owedNow, locale)}</strong>.</>}
            </p>
            <PayoutDetailsForm holder={profile.payoutHolder} last4={profile.payoutCardLast4} />
          </Card>
        </>
      )}

      <h2 className="mb-4 mt-12">{t("Buyurtmalar")}</h2>
      {orders.length === 0 ? (
        <EmptyState title={t("Hozircha buyurtmalar yoʻq")} description={t("Mijoz paketlaringizdan birini buyurtma qilganda, u shu yerda koʻrinadi.")} />
      ) : (
        <OrderList
          rows={orders.map((o) => ({
            id: o.id, status: o.status, title: o.service.title, other: o.client.name,
            price: o.agreedPrice, updatedAt: o.updatedAt, action: t(nextAction(o.status, "provider")),
          }))}
        />
      )}
    </Container>
  );
}
