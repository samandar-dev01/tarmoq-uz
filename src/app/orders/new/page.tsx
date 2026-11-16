import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { getLocale, getT } from "@/i18n/server";
import { formatUZS } from "@/lib/format";
import { revisionsText } from "@/lib/orderUi";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card, tagClasses } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewOrderForm } from "@/components/orders/NewOrderForm";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Yangi buyurtma") };
}

export default async function NewOrderPage(props: { searchParams: Promise<{ service?: string }> }) {
  const searchParams = await props.searchParams;
  await requirePageRole("CLIENT");
  const t = await getT();
  const locale = await getLocale();
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
          title={t("Bu paket mavjud emas")}
          description={t("U oʻchirilgan boʻlishi yoki ijodkor hozir buyurtma qabul qilmayotgan boʻlishi mumkin.")}
          action={<ButtonLink href="/search">{t("Boshqa ijodkorlarni topish")}</ButtonLink>}
        />
      </Container>
    );
  }

  return (
    <Container size="md">
      <h1>{t("Buyurtma: {title}", { title: service.title })}</h1>
      <Card tone="tint" className="mt-6">
        <p className="font-bold">
          <ButtonLink href={`/providers/${service.profile.slug}`} variant="link">{service.profile.user.name}</ButtonLink>
        </p>
        <p data-user-content className="mt-1.5 text-ink-soft">{service.description}</p>
        <p className="mt-3 flex flex-wrap gap-2">
          <span className={tagClasses("saffron")}>{formatUZS(service.price, locale)}</span>
          <span className={tagClasses("white")}>{t("{days} kunda topshiriladi", { days: service.deliveryDays })}</span>
          <span className={tagClasses("white")}>{revisionsText(locale, service.revisions)}</span>
        </p>
      </Card>
      <div className="mt-8">
        <NewOrderForm serviceId={service.id} />
      </div>
    </Container>
  );
}
