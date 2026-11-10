import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: { default: "Andijan Creators", template: "%s · Andijan Creators" },
  description: "Hire trusted local videographers and creators in Andijan, with agreements and protected payments.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Header />
        <main>{children}</main>
        <footer className="mt-16 border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Andijan Creators · Payments run in sandbox mode
        </footer>
      </body>
    </html>
  );
}
