import { safeNext } from "./safeNext";
import type { AppRole } from "./token";

/** The two public ways in: the tabs on the sign-in and sign-up pages. */
export type EntryRole = "client" | "provider";

/** Every sign-in door. The admin door (/login?role=admin) has no tab and no sign-up. */
export type Door = EntryRole | "admin";
export const DOORS = ["client", "provider", "admin"] as const satisfies readonly Door[];

const first = (v: string | string[] | undefined | null) => (Array.isArray(v) ? v[0] : v);

export const parseEntryRole = (v: string | string[] | undefined | null): EntryRole =>
  first(v) === "provider" ? "provider" : "client";

/** Like parseEntryRole, but also knows the admin door. Anything unknown is the client door. */
export const parseDoor = (v: string | string[] | undefined | null): Door => {
  const value = first(v);
  return value === "provider" || value === "admin" ? value : "client";
};

/** The one door an account may sign in through. */
export const doorForRole = (role: AppRole): Door => (role === "ADMIN" ? "admin" : role === "PROVIDER" ? "provider" : "client");

/** The door the account belongs at when it came to another one. Null when the door is right, or none was named. */
export const wrongDoor = (requested: Door | undefined, role: AppRole): Door | null => {
  const own = doorForRole(role);
  return requested && requested !== own ? own : null;
};

/** /login or /register with the role, and the `next` target when it is a safe same-site path. */
export function authHref(page: "/login" | "/register", role: Door, next?: string | null): string {
  const qs = new URLSearchParams({ role });
  const safe = safeNext(next);
  if (safe) qs.set("next", safe);
  return `${page}?${qs.toString()}`;
}

/** Remembers the door of the last successful sign-in. Holds no secret: it only preselects the tab. */
export const LAST_ROLE_COOKIE = "last_role";

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * The door a signed-out visitor of a protected path belongs at. Paths that only one role may open name their door;
 * the rest (/orders/<id>, /messages) fall back to the door used last time (the `last_role` cookie), then to client.
 */
function doorForPath(pathname: string, lastRole?: string | null): Door {
  if (under(pathname, "/admin")) return "admin";
  if (under(pathname, "/dashboard/provider")) return "provider";
  if (under(pathname, "/dashboard/client") || under(pathname, "/checkout") || under(pathname, "/orders/new")) return "client";
  return parseDoor(lastRole);
}

/**
 * The sign-in address for a signed-out visitor of `pathname`. No `next` is added, as before: `requirePageRole`
 * does not know the path, so it uses `doorForRoles` below, which gives the same answer for the same pages.
 */
export const loginPathFor = (pathname: string, lastRole?: string | null): string => authHref("/login", doorForPath(pathname, lastRole));

/**
 * The door for a page that lets in `roles`: a page for one role is that role's door, a page for several (or all)
 * uses the door of the last sign-in, then client.
 */
export function doorForRoles(roles: readonly AppRole[], lastRole?: string | null): Door {
  const only = roles.length === 1 ? roles[0] : undefined;
  return only ? doorForRole(only) : parseDoor(lastRole);
}

export const ROLE_HOME: Record<AppRole, string> = {
  CLIENT: "/dashboard/client",
  PROVIDER: "/dashboard/provider",
  ADMIN: "/admin",
};

/**
 * Creators do not see other creators. The creator list (the home page feed, the search, other creators' profiles)
 * is for visitors, clients and admins; a signed-in creator has only their own cabinet and their own public profile.
 * Every place that lists or links to creators asks this one question, so the rule lives here and nowhere else.
 */
export const canBrowseCreators = (user: { role: AppRole } | null) => user?.role !== "PROVIDER";
