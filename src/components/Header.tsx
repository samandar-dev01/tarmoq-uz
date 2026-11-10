import Link from "next/link";
import { getCurrentUser, ROLE_HOME } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/LogoutButton";

export async function Header() {
  const user = await getCurrentUser();
  const links = (
    <>
      <Link href="/search" className="text-sm font-medium text-slate-600 hover:text-slate-900">Find creators</Link>
      {user ? (
        <>
          <Link href={ROLE_HOME[user.role]} className="text-sm font-medium text-slate-600 hover:text-slate-900">Dashboard</Link>
          <Link href="/messages" className="text-sm font-medium text-slate-600 hover:text-slate-900">Messages</Link>
          <LogoutButton />
        </>
      ) : (
        <>
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">Sign in</Link>
          <Link href="/register" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">Join</Link>
        </>
      )}
    </>
  );
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-indigo-700">Andijan Creators</Link>
        <nav className="hidden items-center gap-5 sm:flex">{links}</nav>
        <details className="relative sm:hidden">
          <summary className="cursor-pointer list-none rounded-lg border border-slate-300 px-3 py-1.5 text-sm">Menu</summary>
          <div className="absolute right-0 z-10 mt-2 flex w-48 flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">{links}</div>
        </details>
      </div>
    </header>
  );
}
