import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authHref, doorForRole, doorForRoles, LAST_ROLE_COOKIE } from "./authRole";
import { prisma } from "./db";
import { HttpError } from "./http";
import { sessionIsCurrent, signToken, verifyToken, type AppRole, type SessionPayload } from "./token";

export const SESSION_COOKIE = "session";
const maxAgeDays = () => Number(process.env.SESSION_MAX_AGE_DAYS ?? 7);

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/** `tokenVersion` is the user's current `User.tokenVersion`; the cookie carries it so a later bump ends this session (see getCurrentUser). */
export async function startSession(user: { id: string; role: AppRole; name: string; tokenVersion: number }) {
  const token = await signToken({ sub: user.id, role: user.role, name: user.name, tv: user.tokenVersion }, maxAgeDays());
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
 * Authoritative user lookup: role and active flag always come from the database, not the token, and so does the session
 * version: a session whose `tv` is not the user's current `tokenVersion` has been ended (password change, "sign out
 * everywhere") and is treated as signed out. A cookie from before versions existed has no `tv`; it counts as 0.
 *
 * What comes back is safe to hand to a page: no password hash, no storage key, no token version. `avatarUpdatedAt` is
 * how a page knows there is a photo (see src/lib/avatar.ts).
 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, phone: true, role: true, isActive: true, avatarUpdatedAt: true, tokenVersion: true },
  });
  if (!user || !user.isActive) return null;
  if (!sessionIsCurrent(session.tv, user.tokenVersion)) return null;
  const { tokenVersion: _tokenVersion, ...visible } = user;
  return visible;
}

/**
 * Ends every session of the user except the one making this request: raises `tokenVersion` (so every cookie issued so
 * far stops matching) and writes a fresh cookie with the new number into THIS browser, which stays signed in.
 * Route handlers only (it sets a cookie). Returns the new version.
 */
export async function endOtherSessions(userId: string): Promise<number> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    select: { id: true, role: true, name: true, tokenVersion: true },
  });
  await startSession(user);
  return user.tokenVersion;
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

// ROLE_HOME and canBrowseCreators live in ./authRole (it has no server imports), so a client component and the unit tests can use them too.
export { canBrowseCreators, ROLE_HOME } from "./authRole";
