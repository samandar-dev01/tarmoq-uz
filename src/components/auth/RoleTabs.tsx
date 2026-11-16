import { NavLink } from "@/components/ui/NavLink";
import { getT } from "@/i18n/server";
import { authHref, type EntryRole } from "@/lib/authRole";

/** Switches the sign-in or sign-up page between the client and the creator entry, keeping `next`. */
export async function RoleTabs({ page, role, next }: { page: "/login" | "/register"; role: EntryRole; next?: string | null }) {
  const t = await getT();
  return (
    <nav aria-label={t("Hisob turi")} className="flex flex-wrap gap-2">
      <NavLink href={authHref(page, "client", next)} variant="tab" active={role === "client"} replace>{t("Mijoz")}</NavLink>
      <NavLink href={authHref(page, "provider", next)} variant="tab" active={role === "provider"} replace>{t("Ijodkor")}</NavLink>
    </nav>
  );
}
