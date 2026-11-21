import { tk } from "../i18n/dictionary";
import { canBrowseCreators, ROLE_HOME } from "./authRole";
import type { AppRole } from "./token";

/**
 * One link of the app shell (the header, the account menu, the footer). `label` is the Uzbek text, which is also its
 * translation key, and `href` has no language prefix: whoever draws the link writes `t(label)` and `localHref(locale, href)`.
 */
export type NavEntry = { href: string; label: string };
type Viewer = { role: AppRole } | null;

/** The role in words, as the sign-in tabs already say it. */
export const ROLE_LABEL: Record<AppRole, string> = { CLIENT: tk("Mijoz"), PROVIDER: tk("Ijodkor"), ADMIN: tk("Admin") };

/**
 * Help is the support team's Telegram: one press opens it in a new tab. Not a `NavEntry`: it is an outside address with no
 * language prefix, so whoever draws it writes `t(HELP.label)` and opens `HELP.href` with `target="_blank" rel="noopener noreferrer"`.
 * It sits in the header (visitors), the account menu (everyone signed in but an admin) and the footer.
 */
export const HELP = { href: "https://t.me/justuzbe", label: tk("Yordam") } as const;

const CREATORS: NavEntry = { href: "/search", label: tk("Ijodkorlar") };
const MESSAGES: NavEntry = { href: "/messages", label: tk("Xabarlar") };
const cabinet = (role: AppRole): NavEntry => ({ href: ROLE_HOME[role], label: role === "ADMIN" ? tk("Admin") : tk("Kabinet") });

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
    return [CREATORS, { href: "/register?role=provider", label: tk("Ijodkor boʻlib qoʻshilish") }, { href: "/register?role=client", label: tk("Buyurtma bermoqchiman") }];
  }
  if (viewer.role === "ADMIN") return [cabinet("ADMIN")];
  return [...(canBrowseCreators(viewer) ? [CREATORS] : []), cabinet(viewer.role), MESSAGES];
}
