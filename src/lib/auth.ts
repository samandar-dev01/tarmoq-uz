import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { cache } from "react";
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

/**
 * Authoritative user lookup: role and active flag always come from the database, not the token.
 *
 * Wrapped in React's `cache`, so while one page is being rendered the layout, the header and the page itself share a
 * single query instead of running it three or four times (a signed-in visitor used to cost that many round trips to the
 * database on every page). The memo lives for ONE request only; the next request asks the database again, so a role
 * change or a deactivated account still takes effect immediately. There is no server action that changes the session in
 * the middle of a render (sign-in, sign-up and sign-out are route handlers), so the memo can not go stale.
 */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, phone: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return user;
});

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

// ROLE_HOME and canBrowseCreators live in ./authRole (it has no server imports), so a client component and the unit tests can use them too.
export { canBrowseCreators, ROLE_HOME } from "./authRole";
