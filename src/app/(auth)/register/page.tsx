import { RegisterForm } from "@/components/auth/RegisterForm";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { parseEntryRole } from "@/lib/authRole";
import { safeNext } from "@/lib/safeNext";

export const metadata = { title: "Roʻyxatdan oʻtish" };

type Props = { searchParams: { role?: string | string[]; next?: string | string[] } };

export default function RegisterPage({ searchParams }: Props) {
  const role = parseEntryRole(searchParams.role);
  const next = safeNext(Array.isArray(searchParams.next) ? searchParams.next[0] : searchParams.next);
  return (
    <Container size="sm">
      <h1>Hisob yarating</h1>
      <p className="mt-2 text-ink-soft">Bir daqiqa ichida tayyor boʻladi. Bank kartasi shart emas.</p>
      <Card padding="lg" className="mt-6">
        {/* key: following a header link to the other role re-selects it; the choice stays changeable in the form. */}
        <RegisterForm key={role} initialRole={role} next={next} />
      </Card>
    </Container>
  );
}
