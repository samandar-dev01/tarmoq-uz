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
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { ManualTransfer } from "@/components/checkout/ManualTransfer";
import { manualPaymentsOn, paymentsAreTest } from "@/lib/payments/mode";
import { manualInstructions, orderReference, TRANSFER_QUERY } from "@/lib/payments/manualPure";
import { ManualOption } from "@/components/checkout/ManualOption";
import { WhopPay } from "@/components/checkout/WhopPay";
import { whopOffered } from "@/lib/payments/whopPure";
import { syncWhopOrder } from "@/lib/payments/whop";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Toʻlov") };
}

export default async function CheckoutPage(props: { params: Promise<{ orderId: string }>; searchParams: Promise<{ qaytdi?: string; [TRANSFER_QUERY.name]?: string }> }) {
  const params = await props.params;
  const query = await props.searchParams;
  const returned = query.qaytdi === "1"; // back from Whop's payment page
  const user = await requirePageRole("CLIENT");
  const t = await getT();
  const locale = await getLocale();
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, clientId: user.id },
    include: { service: { select: { title: true } }, provider: { select: { name: true } } },
  });
  if (!order) notFound();
  // Whop's message may not have arrived yet, so the site asks Whop itself.
  if (returned && order.status === "AWAITING_PAYMENT" && (await syncWhopOrder(order.id))) redirect(`/orders/${order.id}`);
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
  const online = whopOffered() && !waiting; // a transfer being checked must not be paid a second time
  const transfer = instructions && order.agreedPrice ? (
    <ManualTransfer
      orderId={order.id}
      amount={order.agreedPrice}
      reference={orderReference(order.id)}
      card={instructions.card}
      holder={instructions.holder}
      bank={instructions.bank}
      waiting={waiting}
    />
  ) : null;

  return (
    <Container size="sm">
      <h1>{t("Toʻlov")}</h1>
      {online ? (
        // The automatic payment comes first. The transfer by hand is one button below it.
        <div className="mt-6 space-y-5">
          <WhopPay orderId={order.id} amount={order.agreedPrice} service={order.service.title} creator={order.provider.name} returned={returned} />
          {transfer && (
            <>
              <p className="flex items-center gap-3 text-sm font-semibold text-ink-mute before:h-px before:flex-1 before:bg-line-strong after:h-px after:flex-1 after:bg-line-strong">
                {t("yoki")}
              </p>
              <ManualOption initialOpen={query[TRANSFER_QUERY.name] === TRANSFER_QUERY.value}>{transfer}</ManualOption>
            </>
          )}
        </div>
      ) : (
        <>
          <Card tone="tint" className="mt-6">
            <p className="font-bold">{order.service.title}</p>
            <p className="text-ink-soft">{t("{name} bilan", { name: order.provider.name })}</p>
            <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight">{order.agreedPrice ? formatUZS(order.agreedPrice, locale) : "—"}</p>
            <p className="mt-1 text-sm text-ink-soft">{t("Siz tayyor videoni qabul qilmaguncha ushlab turiladi.")}</p>
          </Card>
          <div className="mt-6">
            {paymentsAreTest() ? (
              <CheckoutForm orderId={order.id} />
            ) : (
              transfer ?? <Alert variant="error">{t("Toʻlov rekvizitlari hali sozlanmagan. Administrator bilan bogʻlaning.")}</Alert>
            )}
          </div>
        </>
      )}
    </Container>
  );
}
