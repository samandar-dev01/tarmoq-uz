import { canBrowseCreators, ROLE_HOME } from "./authRole";
import type { AppRole } from "./token";

/** One link of the app shell (the header, the account menu, the footer). */
export type NavEntry = { href: string; label: string };
type Viewer = { role: AppRole } | null;

/** The role in words, as the sign-in tabs already say it. */
export const ROLE_LABEL: Record<AppRole, string> = { CLIENT: "Mijoz", PROVIDER: "Ijodkor", ADMIN: "Admin" };

const CREATORS: NavEntry = { href: "/search", label: "Ijodkorlar" };
const MESSAGES: NavEntry = { href: "/messages", label: "Xabarlar" };
const cabinet = (role: AppRole): NavEntry => ({ href: ROLE_HOME[role], label: role === "ADMIN" ? "Admin" : "Kabinet" });

/**
 * The plain links in the header on a wide screen. A visitor has the creator list (the sign-in buttons are not in this list);
 * a signed-in person has the same two shortcuts the account menu holds: the creator list when they may see it, and messages
 * (an admin has no inbox).
 */
export function headerLinks(viewer: Viewer): NavEntry[] {
  return [...(canBrowseCreators(viewer) ? [CREATORS] : []), ...(viewer && viewer.role !== "ADMIN" ? [MESSAGES] : [])];
}

/** The destinations in the account menu, in reading order: the cabinet first, then messages, then the creator list. */
export function accountMenuLinks(viewer: { role: AppRole }): NavEntry[] {
  return [cabinet(viewer.role), ...(viewer.role !== "ADMIN" ? [MESSAGES] : []), ...(canBrowseCreators(viewer) ? [CREATORS] : [])];
}

/**
 * The footer's links by who is looking. A visitor is invited to join; a signed-in person is not asked to sign up again and
 * gets their own shortcuts instead (a creator never gets the creator list, an admin only the admin area).
 */
export function footerLinks(viewer: Viewer): NavEntry[] {
  if (!viewer) {
    return [CREATORS, { href: "/register?role=provider", label: "Ijodkor boʻlib qoʻshilish" }, { href: "/register?role=client", label: "Buyurtma bermoqchiman" }];
  }
  if (viewer.role === "ADMIN") return [cabinet("ADMIN")];
  return [...(canBrowseCreators(viewer) ? [CREATORS] : []), cabinet(viewer.role), MESSAGES];
}
