import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";

export const metadata = { title: "Kirish" };

export default function LoginPage() {
  return (
    <Container size="sm">
      <h1>Hisobingizga kiring</h1>
      <p className="mt-2 text-ink-soft">Buyurtmalaringiz va xabarlaringiz shu yerda.</p>
      <Card padding="lg" className="mt-6">
        <Suspense fallback={<p className="text-sm text-ink-soft">Yuklanmoqda…</p>}>
          <LoginForm />
        </Suspense>
      </Card>
    </Container>
  );
}
