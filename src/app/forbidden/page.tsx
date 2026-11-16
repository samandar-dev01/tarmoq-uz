import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Ruxsat yoʻq") };
}

export default async function Forbidden() {
  const t = await getT();
  return (
    <Container size="sm" pad="section" className="text-center">
      <h1>{t("Bu sahifaga kirish huquqingiz yoʻq")}</h1>
      <p className="mt-3 text-ink-soft">{t("Hisobingiz turi bu boʻlimga ruxsat bermaydi.")}</p>
      <ButtonLink href="/" size="lg" className="mt-8">{t("Bosh sahifaga qaytish")}</ButtonLink>
    </Container>
  );
}
