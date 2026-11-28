import Link from "next/link";
import { requirePageRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLocale, getT } from "@/i18n/server";
import { formatMoment } from "@/lib/format";
import { noticeText } from "@/lib/notificationsPure";
import { cardClasses } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { AllowAlerts } from "@/components/AllowAlerts";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Bildirishnomalar"), robots: { index: false, follow: false } };
}

export default async function NotificationsPage() {
  const user = await requirePageRole("CLIENT", "PROVIDER", "ADMIN");
  const t = await getT();
  const locale = await getLocale();
  const list = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  // Seen now. The list above still shows which were new.
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return (
    <Container size="md">
      <h1>{t("Bildirishnomalar")}</h1>
      <AllowAlerts />
      {list.length === 0 ? (
        <div className="mt-6"><EmptyState title={t("Hozircha bildirishnomalar yoʻq")} description={t("Buyurtma va takliflardagi yangiliklar shu yerda koʻrinadi.")} /></div>
      ) : (
        <ul className="mt-6 space-y-3">
          {list.map((n) => (
            <li key={n.id}>
              <Link href={n.href} className={cardClasses({ interactive: true, padding: "sm", tone: n.readAt ? "white" : "tint", className: "block" })}>
                <span data-user-content className="block font-semibold">{t(noticeText(n.kind), { subject: n.subject })}</span>
                <span className="mt-1 block text-sm text-ink-soft">{formatMoment(n.createdAt, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
