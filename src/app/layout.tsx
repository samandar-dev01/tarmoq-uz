import type { Metadata, Viewport } from "next";
import { Onest, Unbounded } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { FlashToast } from "@/components/ui/FlashToast";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { canBrowseCreators, getCurrentUser } from "@/lib/auth";
import { paymentsAreTest } from "@/lib/payments/mode";

// Unbounded (wide, round) is for headlines and the logo; Onest is for everything you read. Both cover Latin and Cyrillic.
const display = Unbounded({ subsets: ["latin", "latin-ext", "cyrillic"], weight: ["500", "700", "800"], variable: "--font-display", display: "swap" });
const sans = Onest({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Tarmoq.uz: ijodkorlar tarmogʻi", template: "%s · Tarmoq.uz" },
  // No payment promise here: a meta description cannot carry the "Sinov rejimi" badge (hard rule 2).
  description: "Oʻzbekistondagi videograf, fotograf va montajchilarni toping, narxlarini solishtiring va shartlarni yozma kelishib oling.",
};
// The browser bar colour cannot read CSS variables, so this mirrors --c-paper in globals.css.
const THEME_COLOR = "#090D16";
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: THEME_COLOR };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getCurrentUser();
  return (
    <html lang="uz" data-scroll-behavior="smooth" className={`${display.variable} ${sans.variable}`}>
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
        <Header />
        <main className="flex-1">{children}</main>
        <FlashToast />
        <footer className="mt-24 border-t border-line bg-surface">
          <Container pad="none" className="grid gap-8 py-12 sm:grid-cols-[1.4fr_1fr] sm:items-start">
            <div>
              <p className="font-display text-2xl font-bold tracking-tight">
                tarmoq<span className="text-cobalt-dark">.uz</span>
              </p>
              <p className="mt-2 max-w-sm text-ink-soft">Oʻzbekiston ijodkorlari bir tarmoqda: videograf, fotograf va montajchilarni toping.</p>
            </div>
            <nav aria-label="Pastki menyu" className="flex flex-wrap gap-x-6 gap-y-0 sm:justify-end">
              {canBrowseCreators(viewer) && <ButtonLink href="/search" variant="link" className="inline-flex min-h-11 items-center">Ijodkorlar</ButtonLink>}
              <ButtonLink href="/register?role=provider" variant="link" className="inline-flex min-h-11 items-center">Ijodkor boʻlib qoʻshilish</ButtonLink>
              <ButtonLink href="/register?role=client" variant="link" className="inline-flex min-h-11 items-center">Buyurtma bermoqchiman</ButtonLink>
            </nav>
          </Container>
          <div className="border-t border-line bg-paper">
            <Container pad="none" className="py-4 text-sm text-ink-soft">
              © {new Date().getFullYear()} Tarmoq.uz.{paymentsAreTest() && " Toʻlovlar hozircha sinov rejimida ishlaydi: haqiqiy pul yechilmaydi."}
            </Container>
          </div>
        </footer>
      </body>
    </html>
  );
}
