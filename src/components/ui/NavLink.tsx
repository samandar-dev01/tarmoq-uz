"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { useHydrated } from "./useHydrated";

type Props = ComponentProps<typeof Link> & { exact?: boolean; variant?: "nav" | "tab" };

const VARIANTS = {
  nav: {
    base: "inline-flex min-h-10 items-center rounded-ctl px-3 text-[0.9375rem] font-semibold transition-colors",
    idle: "text-ink hover:bg-ink/10",
    active: "bg-saffron text-ink",
  },
  tab: {
    base: "inline-flex min-h-10 items-center rounded-ctl border-2 border-ink px-4 text-sm font-bold transition-colors",
    idle: "bg-white text-ink hover:bg-paper-deep",
    active: "bg-ink text-white",
  },
} as const;

/** A link that marks the page you are on, and closes the mobile menu (<details>) it may sit in when tapped. */
export function NavLink({ href, exact = false, variant = "nav", className = "", onClick, ...rest }: Props) {
  const pathname = usePathname();
  useHydrated(); // every page has a NavLink in its header, so this marks the page as interactive (see useHydrated)
  const target = typeof href === "string" ? href : (href.pathname ?? "");
  const active = exact ? pathname === target : pathname === target || pathname.startsWith(`${target}/`);
  const v = VARIANTS[variant];
  return (
    <Link
      {...rest}
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={(e) => {
        e.currentTarget.closest("details")?.removeAttribute("open");
        onClick?.(e);
      }}
      className={`${v.base} ${active ? v.active : v.idle} ${className}`.trim()}
    />
  );
}
