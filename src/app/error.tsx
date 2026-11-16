"use client";
import { useLocale, useT } from "@/i18n/client";
import { localHref } from "@/i18n/paths";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { ErrorState } from "@/components/ui/ErrorState";

export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  const t = useT();
  const locale = useLocale();
  return (
    <Container size="sm" pad="section" className="text-center">
      <ErrorState message={t("Sahifani hozir ochib boʻlmadi. Birozdan soʻng qayta urinib koʻring.")} onRetry={reset} />
      <ButtonLink href={localHref(locale, "/")} variant="link" className="mt-6 inline-flex min-h-11 items-center">{t("Bosh sahifaga qaytish")}</ButtonLink>
    </Container>
  );
}
