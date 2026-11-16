"use client";
import { useT } from "@/i18n/client";
import { Container } from "@/components/ui/Container";
import { ErrorState } from "@/components/ui/ErrorState";

export default function SearchError({ reset }: { error: Error; reset: () => void }) {
  const t = useT();
  return (
    <Container pad="section">
      <ErrorState message={t("Ijodkorlarni hozir yuklab boʻlmadi.")} onRetry={reset} />
    </Container>
  );
}
