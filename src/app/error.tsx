"use client";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { ErrorState } from "@/components/ui/ErrorState";

export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container size="sm" pad="section" className="text-center">
      <ErrorState message="Sahifani hozir ochib boʻlmadi. Birozdan soʻng qayta urinib koʻring." onRetry={reset} />
      <ButtonLink href="/" variant="link" className="mt-6 inline-flex min-h-11 items-center">Bosh sahifaga qaytish</ButtonLink>
    </Container>
  );
}
