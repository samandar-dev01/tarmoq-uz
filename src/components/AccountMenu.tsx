"use client";
import { usePathname } from "next/navigation";
import { useSignOut } from "@/components/auth/useSignOut";
import { useHelp } from "@/components/help/HelpProvider";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { Menu, MenuButton, MenuLink, MenuSeparator } from "@/components/ui/Menu";
import { useT } from "@/i18n/client";
import { isCurrentPath } from "@/lib/currentPath";
import type { NavEntry } from "@/lib/shellNav";

/**
 * The one place for a signed-in person in the header: their initials, and under them who they are, where they can go and
 * how to sign out. The destinations come from the server (src/lib/shellNav.ts), which knows the role; the header hands
 * them over already in the reader's language.
 */
export function AccountMenu({ name, roleLabel, links, showHelp }: { name: string; roleLabel: string; links: NavEntry[]; showHelp: boolean }) {
  const pathname = usePathname();
  const { signOut, signingOut } = useSignOut();
  const { open: openHelp, unread } = useHelp();
  const t = useT();
  const waiting = showHelp && unread > 0; // the support team has answered and it is not read yet
  return (
    <Menu
      label={t("Hisob menyusi: {name}", { name })}
      trigger={
        <span className="relative">
          <Avatar name={name} size="sm" />
          {waiting && (
            <>
              <span aria-hidden="true" className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-saffron ring-2 ring-paper" />
              <span className="sr-only">{t("Yangi javob bor")}</span>
            </>
          )}
        </span>
      }
      triggerClassName={buttonClasses({ variant: "ghost", size: "icon", className: "aria-expanded:bg-ink/10" })}
      header={
        <>
          <p className="break-words font-bold text-ink">{name}</p>
          <p className="text-sm text-ink-soft">{roleLabel}</p>
        </>
      }
    >
      {links.map((link) => (
        <MenuLink key={link.href} href={link.href} current={isCurrentPath(pathname, link.href)}>
          {link.label}
        </MenuLink>
      ))}
      {/* «Sozlamalar» goes here, after the destinations, when the settings page exists (a later wave). */}
      {showHelp && (
        <MenuButton onSelect={openHelp}>
          {t("Yordam")}
          {waiting && <span aria-hidden="true" className="ml-2 h-2.5 w-2.5 rounded-full bg-saffron" />}
        </MenuButton>
      )}
      <MenuSeparator />
      {/* Stays open and says «Chiqilmoqda…» until the page changes to the signed-out home. */}
      <MenuButton onSelect={signOut} closeOnSelect={false} busy={signingOut}>
        {signingOut ? t("Chiqilmoqda…") : t("Chiqish")}
      </MenuButton>
    </Menu>
  );
}
