import { NavLink } from "@/components/ui/NavLink";
import { authHref, type EntryRole } from "@/lib/authRole";

/** Switches the sign-in or sign-up page between the client and the creator entry, keeping `next`. */
export function RoleTabs({ page, role, next }: { page: "/login" | "/register"; role: EntryRole; next?: string | null }) {
  return (
    <nav aria-label="Hisob turi" className="flex flex-wrap gap-2">
      <NavLink href={authHref(page, "client", next)} variant="tab" active={role === "client"} replace>Mijoz</NavLink>
      <NavLink href={authHref(page, "provider", next)} variant="tab" active={role === "provider"} replace>Ijodkor</NavLink>
    </nav>
  );
}
