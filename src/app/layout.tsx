import type { Metadata, Viewport } from "next";
import { Onest, Unbounded } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { HelpButton } from "@/components/help/HelpButton";
import { HelpProvider } from "@/components/help/HelpProvider";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { LocaleProvider } from "@/i18n/client";
import { OG_LOCALE } from "@/i18n/config";
import { translator } from "@/i18n/dictionary";
import { localHref } from "@/i18n/paths";
import { getLocale } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { paymentsAreTest } from "@/lib/payments/mode";
import { footerLinks } from "@/lib/shellNav";
import { SITE_NAME, siteUrl } from "@/lib/site";
import { getTheme } from "@/lib/theme";
import { THEME_BROWSER_COLOR } from "@/lib/themePure";

// Unbounded (wide, round) is for headlines and the logo; Onest is for everything you read. Both cover Latin and Cyrillic.
const display = Unbounded({ subsets: ["latin", "latin-ext", "cyrillic"], weight: ["500", "700", "800"], variable: "--font-display", display: "swap" });
const sans = Onest({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-sans", display: "swap" });

// The site-wide defaults, in the reader's language (the request is read, which the layout below does anyway).
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = translator(locale);
  return {
    title: { default: t("Tarmoq.uz: ijodkorlar tarmogʻi"), template: "%s · Tarmoq.uz" },
    // No payment promise here: a meta description cannot carry the "Sinov rejimi" badge (hard rule 2).
    description: t("Oʻzbekistondagi videograf, fotograf va montajchilarni toping, narxlarini solishtiring va shartlarni yozma kelishib oling."),
    // Every address search engines and link previews see is built from APP_URL (src/lib/site.ts), so a new domain is one setting.
    metadataBase: new URL(siteUrl()),
    // The share picture comes from app/opengraph-image.tsx. A page that sets its own openGraph repeats it (ogDefaults in src/lib/seo.ts).
    openGraph: { siteName: SITE_NAME, locale: OG_LOCALE[locale], type: "website" },
    twitter: { card: "summary_large_image" },
    // Optional owner-set codes for Google Search Console and Yandex Webmaster; nothing is printed when they are empty.
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined, yandex: process.env.YANDEX_VERIFICATION || undefined },
  };
}
// The browser bar colour follows the visitor's colour scheme. It cannot read CSS variables, so it gets the scheme's paper colour
// (src/lib/themePure.ts) from the same `theme` cookie the layout below uses. Reading a cookie here makes the route dynamic,
// which the layout already is (it reads the session).
export async function generateViewport(): Promise<Viewport> {
  return { width: "device-width", initialScale: 1, themeColor: THEME_BROWSER_COLOR[await getTheme()] };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getCurrentUser();
  // The scheme is decided here, on the server, from the cookie: the first byte of HTML is already in it (no script, no flash).
  const theme = await getTheme();
  // The language is decided here too (src/i18n/server.ts) and handed to the client components, so both write the same text.
  const locale = await getLocale();
  const t = translator(locale);
  return (
    <html lang={locale} data-theme={theme} data-scroll-behavior="smooth" className={`${display.variable} ${sans.variable}`}>
      <body className="flex min-h-screen flex-col">
        {/* Shared by every creator cover (class "ikat"): rows of threads slip sideways a little, like dyed warp. */}
        <svg aria-hidden="true" width="0" height="0" className="absolute">
          <defs>
            <filter id="ikat" x="-5%" y="-5%" width="110%" height="110%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.6 0" result="soft" />
              <feTurbulence type="fractalNoise" baseFrequency="0.006 0.07" numOctaves="2" seed="7" result="noise" />
              <feDisplacementMap in="soft" in2="noise" scale="16" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
        <LocaleProvider locale={locale}>
        {/* One Help sheet for the whole site; the account menu, the visitor's header and the footer open it. */}
        <HelpProvider role={viewer?.role ?? null}>
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="mt-24 border-t border-line bg-surface">
          <Container pad="none" className="grid gap-8 py-12 sm:grid-cols-[1.4fr_1fr] sm:items-start">
            <div>
              <p className="font-display text-2xl font-bold tracking-tight">
                tarmoq<span className="text-cobalt-dark">.uz</span>
              </p>
              <p className="mt-2 max-w-sm text-ink-soft">{t("Oʻzbekiston ijodkorlari bir tarmoqda: videograf, fotograf va montajchilarni toping.")}</p>
            </div>
            <nav aria-label={t("Pastki menyu")} className="flex flex-wrap gap-x-6 gap-y-0 sm:justify-end">
              {footerLinks(viewer).map((link) => (
                <ButtonLink key={link.href} href={localHref(locale, link.href)} variant="link" className="inline-flex min-h-11 items-center">{t(link.label)}</ButtonLink>
              ))}
              {viewer?.role !== "ADMIN" && <HelpButton variant="footer" />}
            </nav>
          </Container>
          <div className="border-t border-line bg-paper">
            <Container pad="none" className="py-4 text-sm text-ink-soft">
              © {new Date().getFullYear()} Tarmoq.uz.{paymentsAreTest() && ` ${t("Toʻlovlar hozircha sinov rejimida ishlaydi: haqiqiy pul yechilmaydi.")}`}
            </Container>
          </div>
        </footer>
        </HelpProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
