import { RegisterForm } from "@/components/auth/RegisterForm";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getT } from "@/i18n/server";
import { parseEntryRole } from "@/lib/authRole";
import { safeNext } from "@/lib/safeNext";

export async function generateMetadata() {
  return { title: (await getT())("Roʻyxatdan oʻtish") };
}

type Props = { searchParams: Promise<{ role?: string | string[]; next?: string | string[] }> };

export default async function RegisterPage(props: Props) {
  const searchParams = await props.searchParams;
  const role = parseEntryRole(searchParams.role);
  const next = safeNext(Array.isArray(searchParams.next) ? searchParams.next[0] : searchParams.next);
  const t = await getT();
  return (
    <Container size="sm">
      <h1>{t("Hisob yarating")}</h1>
      <p className="mt-2 text-ink-soft">{t("Bir daqiqa ichida tayyor boʻladi. Bank kartasi shart emas.")}</p>
      <Card padding="lg" className="mt-6">
        {/* key: following a header link to the other role re-selects it; the choice stays changeable in the form. */}
        <RegisterForm key={role} initialRole={role} next={next} />
      </Card>
    </Container>
  );
}
