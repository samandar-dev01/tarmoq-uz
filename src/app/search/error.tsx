"use client";
import { Container } from "@/components/ui/Container";
import { ErrorState } from "@/components/ui/ErrorState";

export default function SearchError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container pad="section">
      <ErrorState message="Ijodkorlarni hozir yuklab boʻlmadi." onRetry={reset} />
    </Container>
  );
}
