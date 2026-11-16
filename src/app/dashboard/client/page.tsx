import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { nextAction } from "@/lib/orderUi";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatTile } from "@/components/ui/StatTile";
import { OrderList } from "@/components/orders/OrderList";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Mijoz kabineti") };
}

export default async function ClientDashboard() {
  const user = await requirePageRole("CLIENT");
  const t = await getT();
  const orders = await prisma.order.findMany({
    where: { clientId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { service: { select: { title: true } }, provider: { select: { name: true } }, review: { select: { id: true } } },
  });

  const active = orders.filter((o) => !["COMPLETED", "CANCELLED"].includes(o.status)).length;
  const needsAction = orders.filter((o) => ["AGREEMENT_PENDING", "AWAITING_PAYMENT", "DELIVERED"].includes(o.status) || (o.status === "COMPLETED" && !o.review)).length;
  const completed = orders.filter((o) => o.status === "COMPLETED").length;

  return (
    <Container size="xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>{t("Salom, {name}!", { name: user.name.split(" ")[0]! })}</h1>
        <ButtonLink href="/search" size="lg">{t("Ijodkor topish")}</ButtonLink>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatTile label={t("Faol buyurtmalar")} value={active} />
        <StatTile label={t("Sizdan harakat kutilmoqda")} value={needsAction} tone="saffron" />
        <StatTile label={t("Yakunlangan")} value={completed} tone="turquoise" />
      </dl>

      <h2 className="mb-4 mt-12">{t("Buyurtmalaringiz")}</h2>
      {orders.length === 0 ? (
        <EmptyState
          title={t("Hozircha buyurtmalar yoʻq")}
          description={t("Ijodkorni qidiring, paket tanlang va birinchi buyurtmangizni yuboring.")}
          action={<ButtonLink href="/search">{t("Ijodkorlarni koʻrish")}</ButtonLink>}
        />
      ) : (
        <OrderList
          rows={orders.map((o) => ({
            id: o.id, status: o.status, title: o.service.title, other: o.provider.name,
            price: o.agreedPrice, updatedAt: o.updatedAt, action: t(nextAction(o.status, "client", !!o.review)),
          }))}
        />
      )}
    </Container>
  );
}
