import Link from "next/link";
import { canBrowseCreators, getCurrentUser } from "@/lib/auth";
import { CATALOG, catalogName } from "@/lib/catalog";
import { avatarUrl } from "@/lib/avatar";
import { HeaderBell, MessagesLink } from "@/components/UnreadLinks";
import { unreadCounts } from "@/lib/notifications";
import { AccountMenu } from "@/components/AccountMenu";
import { CategoryBar } from "@/components/CategoryBar";
import { HideOnAuthPages } from "@/components/HideOnAuthPages";
import { buttonClasses } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { NavLink } from "@/components/ui/NavLink";
import { LangToggle } from "@/components/ui/LangToggle";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { russianLive } from "@/i18n/config";
import { translator } from "@/i18n/dictionary";
import { localHref } from "@/i18n/paths";
import { getLocale } from "@/i18n/server";
import { accountMenuLinks, HELP, headerLinks, ROLE_LABEL } from "@/lib/shellNav";
import { getTheme } from "@/lib/theme";

export async function Header() {
  const user = await getCurrentUser();
  const theme = await getTheme();
  const locale = await getLocale();
  const t = translator(locale);
  // Shell links carry Uzbek labels and unprefixed paths (src/lib/shellNav.ts): translated and given their address here.
  const entry = (link: { href: string; label: string }) => ({ href: localHref(locale, link.href), label: t(link.label) });
  // With the language button the bar holds one more 44 px control. On the narrowest phones (under 380 px) the wordmark
  // and the gap step down so it still fits. While Russian is off there is no button and the classes are as before.
  const live = russianLive();
  // The two ways in, one for a client and one for a creator: in the bar on a wide screen, and on a phone both under the
  // bar (in view) and inside Menyu (still at hand after scrolling).
  // In the bar and inside Menyu the client's is plain text and the creator's is framed. Under the bar on a phone both are
  // framed and share the row (`block`), so neither is easy to miss.
  const framed = (className = "") => buttonClasses({ variant: "outline", size: "sm", className });
  const signIn = (block = false) => (
    <>
      <NavLink href="/login?role=client" {...(block ? { variant: "plain" as const, className: framed("flex-1") } : {})}>{t("Mijoz sifatida kirish")}</NavLink>
      <NavLink href="/login?role=provider" variant="plain" className={framed(block ? "flex-1" : "")}>{t("Ijodkor sifatida kirish")}</NavLink>
    </>
  );
  // A signed-in person's unread messages and notifications, for the badges.
  const unread = user ? await unreadCounts(user.id) : null;
  // The plain links of a wide screen. A signed-in person has the account menu for everything else (and on a phone for all of it).
  const links = (
    <>
      {headerLinks(user).map(entry).map((link) =>
        unread && link.href === "/messages" ? (
          <MessagesLink key={link.href} href={link.href} label={link.label} count={unread.messages} />
        ) : (
          <NavLink key={link.href} href={link.href}>{link.label}</NavLink>
        ),
      )}
      {!user && (
        <>
          {/* A visitor has no account menu to hold Help, so it is a link here (and in the footer): Telegram, in a new tab. */}
          <NavLink href={HELP.href} target="_blank" rel="noopener noreferrer">{t(HELP.label)}</NavLink>
          {/* Two ways in, never one: a client and a creator each get their own button. */}
          {signIn()}
        </>
      )}
    </>
  );
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-md">
        <Container pad="none" className={`flex items-center justify-between ${live ? "gap-2 min-[380px]:gap-4" : "gap-4"} py-3.5`}>
          <Link href={localHref(locale, "/")} aria-label={t("Tarmoq.uz: bosh sahifa")} className="flex items-center gap-2.5 rounded-ctl">
            {/* The mark: three connected nodes that form a T. */}
            <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
              <rect x="0.5" y="0.5" width="31" height="31" rx="10" fill="rgb(var(--c-cobalt))" stroke="rgb(var(--c-line) / var(--c-line-strong-a))" />
              <path d="M9 11.5h14M16 11.5V23" stroke="rgb(var(--c-cover-ink))" strokeWidth="3" strokeLinecap="round" />
              <circle cx="9" cy="11.5" r="2.8" fill="rgb(var(--c-saffron))" stroke="rgb(var(--c-cover-night))" strokeWidth="1.5" />
              <circle cx="23" cy="11.5" r="2.8" fill="rgb(var(--c-saffron))" stroke="rgb(var(--c-cover-night))" strokeWidth="1.5" />
              <circle cx="16" cy="23" r="2.8" fill="rgb(var(--c-saffron))" stroke="rgb(var(--c-cover-night))" strokeWidth="1.5" />
            </svg>
            <span className={`font-display ${live ? "text-base min-[380px]:text-xl" : "text-xl"} font-bold tracking-tight`}>
              tarmoq<span className="text-cobalt-dark">.uz</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <nav aria-label={t("Asosiy menyu")} className="hidden items-center gap-2 md:flex">{links}</nav>
            {/* One colour-scheme button, always in view: beside the nav on a wide screen, beside the account menu or Menyu (not inside it) on a phone. */}
            <ThemeToggle initial={theme} />
            {/* The one language button, beside it at every width. Not drawn at all while Russian is off (src/i18n/config.ts). */}
            {live && <LangToggle initial={locale} />}
            {user && unread && <HeaderBell initial={unread} />}
            {user ? (
              <AccountMenu name={user.name} photo={avatarUrl(user)} roleLabel={t(ROLE_LABEL[user.role])} links={accountMenuLinks(user).map(entry)} help={user.role === "ADMIN" ? undefined : { href: HELP.href, label: t(HELP.label) }} />
            ) : (
              <details className="relative md:hidden">
                <summary className={buttonClasses({ variant: "ghost", size: "sm" })}>{t("Menyu")}</summary>
                <div className="absolute right-0 mt-3 flex w-64 flex-col items-stretch gap-2 rounded-card border border-line-strong bg-surface p-3 shadow-lift-lg">{links}</div>
              </details>
            )}
          </div>
        </Container>
      </header>
      {/* A visitor on a phone: sign in and sign up in plain view, not only behind Menyu. It scrolls away with the page,
          so the bar that stays on top does not grow. The buttons share a row, and stack when a screen is too narrow. */}
      {!user && (
        <HideOnAuthPages>
          <nav aria-label={t("Kirish")} className="border-b border-line md:hidden">
            <Container pad="none" className="pb-1 pt-3">
              <div className="flex flex-wrap gap-2">{signIn(true)}</div>
              <p className="text-center text-sm text-ink-soft">
                {t("Yangimisiz?")} <ButtonLink href="/register" variant="link" className="inline-flex min-h-11 items-center">{t("Roʻyxatdan oʻting")}</ButtonLink>
              </p>
            </Container>
          </nav>
        </HideOnAuthPages>
      )}
      {/* The directions, for those who look for creators (not for a creator, and an admin works from the admin area). */}
      {canBrowseCreators(user) && user?.role !== "ADMIN" && (
        <CategoryBar
          label={t("Yoʻnalishlar menyusi")}
          categories={CATALOG.map((c) => ({
            name: catalogName(locale, c),
            href: localHref(locale, `/search?category=${c.slug}`),
            items: c.subcategories.map((s) => ({ name: catalogName(locale, s), href: localHref(locale, `/search?sub=${s.slug}&category=${c.slug}`) })),
          }))}
        />
      )}
    </>
  );
}
