import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { ConfirmEmail } from "@/components/security/SecurityForms";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Emailni tasdiqlash"), robots: { index: false, follow: false }, referrer: "no-referrer" as const };
}

export default async function VerifyPage(props: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await props.searchParams;
  if (typeof token !== "string") notFound();
  const t = await getT();
  return (
    <Container size="sm">
      <h1>{t("Emailni tasdiqlash")}</h1>
      <Card padding="lg" className="mt-6"><ConfirmEmail token={token} /></Card>
    </Container>
  );
}
