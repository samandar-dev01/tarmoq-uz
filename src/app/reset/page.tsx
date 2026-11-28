import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { ResetForm } from "@/components/security/SecurityForms";

export async function generateMetadata() {
  const t = await getT();
  // The token is in the address: it must not travel on as a referrer.
  return { title: t("Parolni tiklash"), robots: { index: false, follow: false }, referrer: "no-referrer" as const };
}

export default async function ResetPage(props: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await props.searchParams;
  if (typeof token !== "string") notFound();
  const t = await getT();
  return (
    <Container size="sm">
      <h1>{t("Parolni tiklash")}</h1>
      <Card padding="lg" className="mt-6"><ResetForm token={token} /></Card>
    </Container>
  );
}
