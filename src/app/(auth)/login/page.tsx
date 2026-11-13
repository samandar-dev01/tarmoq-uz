import { LoginForm } from "@/components/auth/LoginForm";
import { RoleTabs } from "@/components/auth/RoleTabs";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { parseEntryRole } from "@/lib/authRole";
import { safeNext } from "@/lib/safeNext";

export const metadata = { title: "Kirish" };

type Props = { searchParams: { role?: string | string[]; next?: string | string[] } };

export default function LoginPage({ searchParams }: Props) {
  const role = parseEntryRole(searchParams.role);
  const next = safeNext(Array.isArray(searchParams.next) ? searchParams.next[0] : searchParams.next);
  return (
    <Container size="sm">
      <h1>{role === "provider" ? "Ijodkor sifatida kirish" : "Mijoz sifatida kirish"}</h1>
      <p className="mt-2 text-ink-soft">
        {role === "provider" ? "Soʻrovlar, buyurtmalar va toʻlovlaringiz shu yerda." : "Buyurtmalaringiz va xabarlaringiz shu yerda."}
      </p>
      <div className="mt-6"><RoleTabs page="/login" role={role} next={next} /></div>
      <Card padding="lg" className="mt-4">
        <LoginForm role={role} next={next} />
      </Card>
    </Container>
  );
}
