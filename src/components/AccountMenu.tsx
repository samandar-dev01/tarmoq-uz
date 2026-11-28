"use client";
import { usePathname } from "next/navigation";
import { useSignOut } from "@/components/auth/useSignOut";
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
export function AccountMenu({ name, photo, roleLabel, links, help }: { name: string; photo?: string | null; roleLabel: string; links: NavEntry[]; help?: NavEntry }) {
  const pathname = usePathname();
  const { signOut, signingOut } = useSignOut();
  const t = useT();
  return (
    <Menu
      label={t("Hisob menyusi: {name}", { name })}
      trigger={<Avatar name={name} src={photo} size="sm" />}
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
      <MenuLink href="/notifications" current={isCurrentPath(pathname, "/notifications")}>{t("Bildirishnomalar")}</MenuLink>
      <MenuLink href="/settings" current={isCurrentPath(pathname, "/settings")}>{t("Sozlamalar")}</MenuLink>
      {/* Help is Telegram, outside the site: it opens in a new tab. Not given to an admin (see Header). */}
      {help && <MenuLink href={help.href} external>{help.label}</MenuLink>}
      <MenuSeparator />
      {/* Stays open and says «Chiqilmoqda…» until the page changes to the signed-out home. */}
      <MenuButton onSelect={signOut} closeOnSelect={false} busy={signingOut}>
        {signingOut ? t("Chiqilmoqda…") : t("Chiqish")}
      </MenuButton>
    </Menu>
  );
}
