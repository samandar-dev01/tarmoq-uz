import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { mailEnabled } from "@/lib/mail";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { ForgotForm } from "@/components/security/SecurityForms";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Parolni tiklash"), robots: { index: false, follow: false } };
}

export default async function ForgotPage() {
  // Nothing to offer until the site can send email.
  if (!mailEnabled()) notFound();
  const t = await getT();
  return (
    <Container size="sm">
      <h1>{t("Parolni tiklash")}</h1>
      <p className="mt-2 text-ink-soft">{t("Emailingizni yozing: yangi parol oʻrnatish uchun havola yuboramiz.")}</p>
      <Card padding="lg" className="mt-6"><ForgotForm /></Card>
    </Container>
  );
}
