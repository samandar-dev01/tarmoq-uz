import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { translator } from "@/i18n/dictionary";
import { localHref } from "@/i18n/paths";
import { getLocale } from "@/i18n/server";

// The 404 page speaks the language of the address that was not found: `/ru/providers/x` (the proxy sets x-locale) or a visitor's
// `lang` cookie. A crawler without cookies on a Russian address therefore gets a Russian 404 with a link to `/ru`.
export async function generateMetadata(): Promise<Metadata> {
  return { title: translator(await getLocale())("Sahifa topilmadi") };
}

export default async function NotFound() {
  const locale = await getLocale();
  const t = translator(locale);
  return (
    <Container size="sm" pad="section" className="text-center">
      <h1>{t("Sahifa topilmadi")}</h1>
      <p className="mt-3 text-ink-soft">{t("Bu manzilda sahifa yoʻq: havola eskirgan yoki notoʻgʻri yozilgan boʻlishi mumkin.")}</p>
      <ButtonLink href={localHref(locale, "/")} size="lg" className="mt-8">{t("Bosh sahifaga qaytish")}</ButtonLink>
    </Container>
  );
}
