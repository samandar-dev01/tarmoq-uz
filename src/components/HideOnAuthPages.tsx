"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Neither page is served under another address (src/proxy.ts rewrites only the public pages), so the server and the
// browser agree on the path.
const AUTH_PAGES = ["/login", "/register"];

/** Draws its children everywhere except on the sign-in and sign-up pages, where they would only repeat the page. */
export function HideOnAuthPages({ children }: { children: ReactNode }) {
  return AUTH_PAGES.includes(usePathname()) ? null : <>{children}</>;
}
