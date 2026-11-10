import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { formatUZS } from "@/lib/format";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card, tagClasses } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewOrderForm } from "@/components/orders/NewOrderForm";

export const metadata = { title: "Yangi buyurtma" };

export default async function NewOrderPage({ searchParams }: { searchParams: { service?: string } }) {
  await requirePageRole("CLIENT");
  if (!searchParams.service) redirect("/search");

  const service = await prisma.service.findUnique({
    where: { id: searchParams.service },
    include: { profile: { include: { user: { select: { name: true, isActive: true } } } } },
  });
  const available = service && service.isActive && service.profile.status === "APPROVED" && service.profile.user.isActive;

  if (!available) {
    return (
      <Container size="md" pad="section">
        <EmptyState
          title="Bu paket mavjud emas"
          description="U oʻchirilgan boʻlishi yoki ijodkor hozir buyurtma qabul qilmayotgan boʻlishi mumkin."
          action={<ButtonLink href="/search">Boshqa ijodkorlarni topish</ButtonLink>}
        />
      </Container>
    );
  }

  return (
    <Container size="md">
      <h1>Buyurtma: {service.title}</h1>
      <Card tone="tint" className="mt-6">
        <p className="font-bold">
          <ButtonLink href={`/providers/${service.profile.slug}`} variant="link">{service.profile.user.name}</ButtonLink>
        </p>
        <p className="mt-1.5 text-ink-soft">{service.description}</p>
        <p className="mt-3 flex flex-wrap gap-2">
          <span className={tagClasses("saffron")}>{formatUZS(service.price)}</span>
          <span className={tagClasses("white")}>{service.deliveryDays} kunda topshiriladi</span>
          <span className={tagClasses("white")}>{service.revisions} ta tuzatish</span>
        </p>
      </Card>
      <div className="mt-8">
        <NewOrderForm serviceId={service.id} />
      </div>
    </Container>
  );
}
