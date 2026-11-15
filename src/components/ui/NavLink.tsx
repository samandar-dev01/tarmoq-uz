"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { useHydrated } from "./useHydrated";

type Props = ComponentProps<typeof Link> & {
  exact?: boolean;
  variant?: "nav" | "tab" | "plain";
  /** Set it when the page cannot be told from the path alone (tabs that differ only in the query string). */
  active?: boolean;
};

const VARIANTS = {
  nav: {
    base: "inline-flex min-h-11 items-center rounded-ctl px-3 text-[0.9375rem] font-semibold transition-colors duration-150 md:min-h-10",
    idle: "text-ink-soft hover:bg-ink/10 hover:text-ink",
    active: "bg-saffron/15 text-saffron-deep",
  },
  tab: {
    base: "inline-flex min-h-11 items-center rounded-ctl border px-4 text-sm font-bold transition-colors duration-150 md:min-h-10",
    idle: "border-line-strong bg-surface text-ink-soft hover:bg-paper-deep hover:text-ink",
    active: "border-transparent bg-cobalt text-on-accent",
  },
  // Looks come from className alone (a link dressed as a Button that must still close the mobile menu).
  plain: { base: "", idle: "", active: "" },
} as const;

/** A link that marks the page you are on, and closes the mobile menu (<details>) it may sit in when tapped. */
export function NavLink({ href, exact = false, variant = "nav", active: forced, className = "", onClick, ...rest }: Props) {
  const pathname = usePathname();
  useHydrated(); // every page has a NavLink in its header, so this marks the page as interactive (see useHydrated)
  const target = typeof href === "string" ? href : (href.pathname ?? "");
  const path = target.split("?")[0]!;
  const active = forced ?? (exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`));
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
