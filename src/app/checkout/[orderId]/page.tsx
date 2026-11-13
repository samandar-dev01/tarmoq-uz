import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { formatUZS } from "@/lib/format";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { TestModeBadge } from "@/components/ui/TestModeBadge";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata = { title: "Toʻlov (sinov rejimi)" };

export default async function CheckoutPage({ params }: { params: { orderId: string } }) {
  const user = await requirePageRole("CLIENT");
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
          title="Bu buyurtma hali toʻlovga tayyor emas"
          description="Toʻlov siz va ijodkor shartlarni qabul qilgandan keyin ochiladi."
          action={<ButtonLink href={`/orders/${order.id}`}>Buyurtmaga qaytish</ButtonLink>}
        />
      </Container>
    );
  }

  return (
    <Container size="sm">
      <h1>Toʻlov</h1>
      <Card tone="tint" className="mt-6">
        <p className="font-bold">{order.service.title}</p>
        <p className="text-ink-soft">{order.provider.name} bilan</p>
        <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight">{order.agreedPrice ? formatUZS(order.agreedPrice) : "—"}</p>
        <p className="mt-1 text-sm text-ink-soft">Siz tayyor videoni qabul qilmaguncha ushlab turiladi. <TestModeBadge /></p>
      </Card>
      <div className="mt-6"><CheckoutForm orderId={order.id} /></div>
    </Container>
  );
}
