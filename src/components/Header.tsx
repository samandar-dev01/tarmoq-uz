import Link from "next/link";
import { getCurrentUser, ROLE_HOME } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { buttonClasses } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
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
          <NavLink href="/login">Kirish</NavLink>
          <ButtonLink href="/register" size="sm">Qoʻshilish</ButtonLink>
        </>
      )}
    </>
  );
  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper/90 backdrop-blur">
      <Container pad="none" className="flex items-center justify-between gap-4 py-3">
        <Link href="/" aria-label="Tarmoq.uz: bosh sahifa" className="flex items-center gap-2.5">
          {/* The mark: three connected nodes that form a T. */}
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="1" y="1" width="30" height="30" rx="9" fill="rgb(var(--c-cobalt))" stroke="rgb(var(--c-ink))" strokeWidth="2" />
            <path d="M9 11.5h14M16 11.5V23" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <circle cx="9" cy="11.5" r="2.8" fill="rgb(var(--c-saffron))" stroke="rgb(var(--c-ink))" strokeWidth="1.5" />
            <circle cx="23" cy="11.5" r="2.8" fill="rgb(var(--c-saffron))" stroke="rgb(var(--c-ink))" strokeWidth="1.5" />
            <circle cx="16" cy="23" r="2.8" fill="rgb(var(--c-saffron))" stroke="rgb(var(--c-ink))" strokeWidth="1.5" />
          </svg>
          <span className="font-display text-xl font-bold tracking-tight">
            tarmoq<span className="text-cobalt">.uz</span>
          </span>
        </Link>
        <nav aria-label="Asosiy menyu" className="hidden items-center gap-1 sm:flex">{links}</nav>
        <details className="relative sm:hidden">
          <summary className={buttonClasses({ variant: "secondary", size: "sm" })}>Menyu</summary>
          <div className="absolute right-0 mt-3 flex w-64 flex-col items-stretch gap-1 rounded-card border-2 border-ink bg-white p-3 shadow-pop">{links}</div>
        </details>
      </Container>
    </header>
  );
}
