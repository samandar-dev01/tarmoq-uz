import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { authHref, doorForRole, doorForRoles, LAST_ROLE_COOKIE } from "./authRole";
import { prisma } from "./db";
import { HttpError } from "./http";
import { touchDue } from "./presence";
import { sessionIsCurrent, signToken, verifyToken, type AppRole, type SessionPayload } from "./token";

export const SESSION_COOKIE = "session";
const maxAgeDays = () => Number(process.env.SESSION_MAX_AGE_DAYS ?? 7);
const signInFirst = () => new HttpError(401, "Davom etish uchun tizimga kiring.");

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
 * everywhere") and counts as signed out. What comes back is safe to hand to a page: no password hash, no storage key,
 * no token version. `avatarUpdatedAt` is how a page knows there is a photo (src/lib/avatar.ts).
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
    select: { id: true, email: true, name: true, phone: true, role: true, isActive: true, avatarUpdatedAt: true, tokenVersion: true, lastSeenAt: true },
  });
  if (!user || !user.isActive) return null;
  if (!sessionIsCurrent(session.tv, user.tokenVersion)) return null;
  // Online status. Not awaited: a slow or failed write must not slow or break the page.
  if (touchDue(user.lastSeenAt)) void prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  const { tokenVersion: _tokenVersion, lastSeenAt: _lastSeenAt, ...visible } = user;
  return visible;
});

/**
 * For writes to the signed-in person's own account that must not outlive the session asking for them. The session is
 * checked when the request arrives, and checking a password takes a moment; meanwhile the session may be ended (password
 * change or reset, "sign out everywhere", the owner of the address arriving through Google). This holds the account's row
 * while `write` runs and, when that happened, refuses the request with nothing written. Do slow work (hashing) before.
 */
export async function whileSignedIn<T>(write: (tx: Prisma.TransactionClient, userId: string) => Promise<T>): Promise<T> {
  const session = await getSession();
  if (!session) throw signInFirst();
  return prisma.$transaction(async (tx) => {
    const held = await tx.$queryRaw<unknown[]>`SELECT 1 FROM "User" WHERE "id" = ${session.sub} AND "tokenVersion" = ${session.tv} FOR UPDATE`;
    if (held.length !== 1) throw signInFirst();
    return write(tx, session.sub);
  });
}

/**
 * Ends every session of the user except the one making this request: raises `tokenVersion` (so every cookie issued so
 * far stops matching) and writes a fresh cookie with the new number into THIS browser, which stays signed in. `also` is
 * written in the same step. Refused when this session has itself been ended meanwhile. Route handlers only (it sets a cookie).
 */
export async function endOtherSessions(also: Prisma.UserUpdateInput = {}): Promise<void> {
  const user = await whileSignedIn((tx, userId) =>
    tx.user.update({
      where: { id: userId },
      data: { ...also, tokenVersion: { increment: 1 } },
      select: { id: true, role: true, name: true, tokenVersion: true },
    }),
  );
  await startSession(user);
}

/** For API route handlers (throws HttpError). */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw signInFirst();
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
