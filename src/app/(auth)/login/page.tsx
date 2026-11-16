import { LoginForm } from "@/components/auth/LoginForm";
import { RoleTabs } from "@/components/auth/RoleTabs";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { tk } from "@/i18n/dictionary";
import { getT } from "@/i18n/server";
import { parseDoor } from "@/lib/authRole";
import { safeNext } from "@/lib/safeNext";

export async function generateMetadata() {
  return { title: (await getT())("Kirish") };
}

type Props = { searchParams: Promise<{ role?: string | string[]; next?: string | string[] }> };

const HEADING = { client: tk("Mijoz sifatida kirish"), provider: tk("Ijodkor sifatida kirish"), admin: tk("Admin") } as const;

export default async function LoginPage(props: Props) {
  const searchParams = await props.searchParams;
  const role = parseDoor(searchParams.role);
  const next = safeNext(Array.isArray(searchParams.next) ? searchParams.next[0] : searchParams.next);
  const t = await getT();
  return (
    <Container size="sm">
      <h1>{t(HEADING[role])}</h1>
      {/* The admin door is not a public tab: it has the form only. */}
      {role !== "admin" && (
        <>
          <p className="mt-2 text-ink-soft">
            {role === "provider" ? t("Soʻrovlar, buyurtmalar va toʻlovlaringiz shu yerda.") : t("Buyurtmalaringiz va xabarlaringiz shu yerda.")}
          </p>
          <div className="mt-6"><RoleTabs page="/login" role={role} next={next} /></div>
        </>
      )}
      <Card padding="lg" className={role === "admin" ? "mt-6" : "mt-4"}>
        <LoginForm role={role} next={next} />
      </Card>
    </Container>
  );
}
