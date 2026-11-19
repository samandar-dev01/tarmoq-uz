import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { getLocale, getT } from "@/i18n/server";
import { formatUZS } from "@/lib/format";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { TestModeBadge } from "@/components/ui/TestModeBadge";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { ManualTransfer } from "@/components/checkout/ManualTransfer";
import { manualPaymentsOn, paymentsAreTest } from "@/lib/payments/mode";
import { manualInstructions, orderReference } from "@/lib/payments/manualPure";

export async function generateMetadata() {
  const t = await getT();
  return { title: paymentsAreTest() ? t("Toʻlov (sinov rejimi)") : t("Toʻlov") };
}

export default async function CheckoutPage(props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  const user = await requirePageRole("CLIENT");
  const t = await getT();
  const locale = await getLocale();
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, clientId: user.id },
    include: { service: { select: { title: true } }, provider: { select: { name: true } } },
  });
  if (!order) notFound();
  if (["IN_PROGRESS", "DELIVERED", "COMPLETED"].includes(order.status)) redirect(`/orders/${order.id}`);

  if (order.status !== "AWAITING_PAYMENT") {
    return (
      <Container size="sm" pad="section">
        <EmptyState
          title={t("Bu buyurtma hali toʻlovga tayyor emas")}
          description={t("Toʻlov siz va ijodkor shartlarni qabul qilgandan keyin ochiladi.")}
          action={<ButtonLink href={`/orders/${order.id}`}>{t("Buyurtmaga qaytish")}</ButtonLink>}
        />
      </Container>
    );
  }

  const manual = manualPaymentsOn();
  const instructions = manual ? manualInstructions() : null;
  const waiting = manual && (await prisma.payment.count({ where: { orderId: order.id, status: "AWAITING_CONFIRMATION" } })) > 0;

  return (
    <Container size="sm">
      <h1>{t("Toʻlov")}</h1>
      <Card tone="tint" className="mt-6">
        <p className="font-bold">{order.service.title}</p>
        <p className="text-ink-soft">{t("{name} bilan", { name: order.provider.name })}</p>
        <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight">{order.agreedPrice ? formatUZS(order.agreedPrice, locale) : "—"}</p>
        <p className="mt-1 text-sm text-ink-soft">{t("Siz tayyor videoni qabul qilmaguncha ushlab turiladi.")} <TestModeBadge /></p>
      </Card>
      <div className="mt-6">
        {!manual ? (
          <CheckoutForm orderId={order.id} />
        ) : instructions && order.agreedPrice ? (
          <ManualTransfer
            orderId={order.id}
            amount={order.agreedPrice}
            reference={orderReference(order.id)}
            card={instructions.card}
            holder={instructions.holder}
            bank={instructions.bank}
            waiting={waiting}
          />
        ) : (
          <Alert variant="error">{t("Toʻlov rekvizitlari hali sozlanmagan. Administrator bilan bogʻlaning.")}</Alert>
        )}
      </div>
    </Container>
  );
}
