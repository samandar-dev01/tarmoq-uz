import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";

export const metadata = { title: "Sahifa topilmadi" };

export default function NotFound() {
  return (
    <Container size="sm" pad="section" className="text-center">
      <h1>Sahifa topilmadi</h1>
      <p className="mt-3 text-ink-soft">Bu manzilda sahifa yoʻq: havola eskirgan yoki notoʻgʻri yozilgan boʻlishi mumkin.</p>
      <ButtonLink href="/" size="lg" className="mt-8">Bosh sahifaga qaytish</ButtonLink>
    </Container>
  );
}
