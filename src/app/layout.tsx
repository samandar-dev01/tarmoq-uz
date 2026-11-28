import type { Metadata, Viewport } from "next";
import { Onest, Unbounded } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { LocaleProvider } from "@/i18n/client";
import { OG_LOCALE } from "@/i18n/config";
import { translator } from "@/i18n/dictionary";
import { getLocale } from "@/i18n/server";
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
    // No payment promise here: search text never says anything about money (hard rule 2).
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
  // The scheme is decided here, on the server, from the cookie: the first byte of HTML is already in it (no script, no flash).
  const theme = await getTheme();
  // The language is decided here too (src/i18n/server.ts) and handed to the client components, so both write the same text.
  const locale = await getLocale();
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
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        </LocaleProvider>
      </body>
    </html>
  );
}
