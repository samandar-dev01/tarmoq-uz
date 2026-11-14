import Link from "next/link";
import { getCurrentUser, ROLE_HOME } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { buttonClasses } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { NavLink } from "@/components/ui/NavLink";

export async function Header() {
  const user = await getCurrentUser();
  const links = (
    <>
      <NavLink href="/search">Ijodkorlar</NavLink>
      {user ? (
        <>
          <NavLink href={ROLE_HOME[user.role]}>{user.role === "ADMIN" ? "Admin" : "Kabinet"}</NavLink>
          {user.role !== "ADMIN" && <NavLink href="/messages">Xabarlar</NavLink>}
          <LogoutButton />
        </>
      ) : (
        <>
          {/* Two ways in, never one: a client and a creator each get their own button. */}
          <NavLink href="/login?role=client" variant="plain" className={buttonClasses({ variant: "secondary", size: "sm" })}>Mijoz sifatida kirish</NavLink>
          <NavLink href="/login?role=provider" variant="plain" className={buttonClasses({ size: "sm" })}>Ijodkor sifatida kirish</NavLink>
        </>
      )}
    </>
  );
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-md">
      <Container pad="none" className="flex items-center justify-between gap-4 py-3.5">
        <Link href="/" aria-label="Tarmoq.uz: bosh sahifa" className="flex items-center gap-2.5 rounded-ctl">
          {/* The mark: three connected nodes that form a T. */}
          <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="0.5" y="0.5" width="31" height="31" rx="10" fill="rgb(var(--c-cobalt))" stroke="rgb(var(--c-line) / 0.16)" />
            <path d="M9 11.5h14M16 11.5V23" stroke="rgb(var(--c-ink))" strokeWidth="3" strokeLinecap="round" />
            <circle cx="9" cy="11.5" r="2.8" fill="rgb(var(--c-saffron))" stroke="rgb(var(--c-night))" strokeWidth="1.5" />
            <circle cx="23" cy="11.5" r="2.8" fill="rgb(var(--c-saffron))" stroke="rgb(var(--c-night))" strokeWidth="1.5" />
            <circle cx="16" cy="23" r="2.8" fill="rgb(var(--c-saffron))" stroke="rgb(var(--c-night))" strokeWidth="1.5" />
          </svg>
          <span className="font-display text-xl font-bold tracking-tight">
            tarmoq<span className="text-cobalt-dark">.uz</span>
          </span>
        </Link>
        <nav aria-label="Asosiy menyu" className="hidden items-center gap-2 md:flex">{links}</nav>
        <details className="relative md:hidden">
          <summary className={buttonClasses({ variant: "secondary", size: "sm" })}>Menyu</summary>
          <div className="absolute right-0 mt-3 flex w-64 flex-col items-stretch gap-2 rounded-card border border-line-strong bg-surface p-3 shadow-lift-lg">{links}</div>
        </details>
      </Container>
    </header>
  );
}
