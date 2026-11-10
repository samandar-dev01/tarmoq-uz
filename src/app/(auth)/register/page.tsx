import { RegisterForm } from "@/components/auth/RegisterForm";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";

export const metadata = { title: "Roʻyxatdan oʻtish" };

export default function RegisterPage() {
  return (
    <Container size="sm">
      <h1>Hisob yarating</h1>
      <p className="mt-2 text-ink-soft">Bir daqiqa ichida tayyor boʻladi. Bank kartasi shart emas.</p>
      <Card padding="lg" className="mt-6">
        <RegisterForm />
      </Card>
    </Container>
  );
}
