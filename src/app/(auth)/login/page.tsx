import { LoginForm } from "@/components/auth/LoginForm";
import { RoleTabs } from "@/components/auth/RoleTabs";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { parseDoor } from "@/lib/authRole";
import { safeNext } from "@/lib/safeNext";

export const metadata = { title: "Kirish" };

type Props = { searchParams: Promise<{ role?: string | string[]; next?: string | string[] }> };

const HEADING = { client: "Mijoz sifatida kirish", provider: "Ijodkor sifatida kirish", admin: "Admin" } as const;

export default async function LoginPage(props: Props) {
  const searchParams = await props.searchParams;
  const role = parseDoor(searchParams.role);
  const next = safeNext(Array.isArray(searchParams.next) ? searchParams.next[0] : searchParams.next);
  return (
    <Container size="sm">
      <h1>{HEADING[role]}</h1>
      {/* The admin door is not a public tab: it has the form only. */}
      {role !== "admin" && (
        <>
          <p className="mt-2 text-ink-soft">
            {role === "provider" ? "Soʻrovlar, buyurtmalar va toʻlovlaringiz shu yerda." : "Buyurtmalaringiz va xabarlaringiz shu yerda."}
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
