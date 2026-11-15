import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authHref, doorForRole, doorForRoles, LAST_ROLE_COOKIE } from "./authRole";
import { prisma } from "./db";
import { HttpError } from "./http";
import { signToken, verifyToken, type AppRole, type SessionPayload } from "./token";

export const SESSION_COOKIE = "session";
const maxAgeDays = () => Number(process.env.SESSION_MAX_AGE_DAYS ?? 7);

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export async function startSession(user: { id: string; role: AppRole; name: string }) {
  const token = await signToken({ sub: user.id, role: user.role, name: user.name }, maxAgeDays());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeDays() * 86400,
  });
  // Not a secret and not trusted: it only preselects the sign-in tab next time (see requirePageRole).
  jar.set(LAST_ROLE_COOKIE, doorForRole(user.role), {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 86400,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifyToken(token) : null;
}

/** Authoritative user lookup: role and active flag always come from the database, not the token. */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, phone: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return user;
}

/** For API route handlers (throws HttpError). */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Davom etish uchun tizimga kiring.");
  return user;
}

export async function requireRole(...roles: AppRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new HttpError(403, "Buning uchun sizda ruxsat yoʻq.");
  }
  return user;
}

/**
 * For server-rendered pages (redirects instead of throwing).
 * A signed-out visitor is sent to the sign-in door of the page: a page for one role names its door by that role;
 * a page several roles share (/orders/<id>, /messages) uses the door of the last sign-in, or the client door.
 */
export async function requirePageRole(...roles: AppRole[]) {
  const user = await getCurrentUser();
  if (!user) redirect(authHref("/login", doorForRoles(roles, (await cookies()).get(LAST_ROLE_COOKIE)?.value)));
  if (!roles.includes(user.role)) redirect("/forbidden");
  return user;
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
