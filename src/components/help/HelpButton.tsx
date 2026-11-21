"use client";
import { buttonClasses } from "@/components/ui/Button";
import { useT } from "@/i18n/client";
import { useHelp } from "./HelpProvider";

// "nav" looks like the header's links (NavLink "nav"); "footer" like the footer's links.
const NAV = "inline-flex min-h-11 items-center rounded-ctl px-3 text-[0.9375rem] font-semibold text-ink-soft transition-colors duration-150 hover:bg-ink/10 hover:text-ink md:min-h-10";
const FOOTER = buttonClasses({ variant: "link", className: "inline-flex min-h-11 items-center" });

/** Opens the Help sheet. Used where there is no account menu to hold it: the header and mobile menu of a visitor, and the footer. */
export function HelpButton({ variant }: { variant: "nav" | "footer" }) {
  const t = useT();
  const { open } = useHelp();
  return (
    <button
      type="button"
      className={variant === "nav" ? NAV : FOOTER}
      onClick={(e) => {
        e.currentTarget.closest("details")?.removeAttribute("open"); // from the mobile menu: close it first
        open();
      }}
    >
      {t("Yordam")}
    </button>
  );
}
