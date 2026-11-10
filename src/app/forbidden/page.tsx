import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";

export const metadata = { title: "Ruxsat yoʻq" };

export default function Forbidden() {
  return (
    <Container size="sm" pad="section" className="text-center">
      <h1>Bu sahifaga kirish huquqingiz yoʻq</h1>
      <p className="mt-3 text-ink-soft">Hisobingiz turi bu boʻlimga ruxsat bermaydi.</p>
      <ButtonLink href="/" size="lg" className="mt-8">Bosh sahifaga qaytish</ButtonLink>
    </Container>
  );
}
