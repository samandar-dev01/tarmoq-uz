import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getT } from "@/i18n/server";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { ConfirmEmail } from "@/components/security/SecurityForms";
import { getCurrentUser } from "@/lib/auth";
import { LAST_ROLE_COOKIE, authHref, parseDoor } from "@/lib/authRole";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Emailni tasdiqlash"), robots: { index: false, follow: false }, referrer: "no-referrer" as const };
}

export default async function VerifyPage(props: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await props.searchParams;
  if (typeof token !== "string") notFound();
  const t = await getT();
  // Only the account's own signed-in person can confirm (src/app/api/auth/verify-email). Signing in brings them back here.
  const user = await getCurrentUser();
  const door = parseDoor((await cookies()).get(LAST_ROLE_COOKIE)?.value);
  return (
    <Container size="sm">
      <h1>{t("Emailni tasdiqlash")}</h1>
      <Card padding="lg" className="mt-6">
        {user ? (
          <ConfirmEmail token={token} />
        ) : (
          <div className="space-y-4">
            <p>{t("Emailni tasdiqlash uchun avval shu hisobga kiring. Bu hisobni siz ochmagan boʻlsangiz, hech narsa qilmang.")}</p>
            <ButtonLink href={authHref("/login", door, `/verify?token=${encodeURIComponent(token)}`)} size="lg" className="w-full">{t("Kirish")}</ButtonLink>
          </div>
        )}
      </Card>
    </Container>
  );
}
