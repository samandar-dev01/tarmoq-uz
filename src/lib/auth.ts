import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { HttpError } from "./http";
import { signToken, verifyToken, type AppRole, type SessionPayload } from "./token";

export const SESSION_COOKIE = "session";
const maxAgeDays = () => Number(process.env.SESSION_MAX_AGE_DAYS ?? 7);

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export async function startSession(user: { id: string; role: AppRole; name: string }) {
  const token = await signToken({ sub: user.id, role: user.role, name: user.name }, maxAgeDays());
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeDays() * 86400,
  });
}

export function endSession() {
  cookies().delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
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

/** For server-rendered pages (redirects instead of throwing). */
export async function requirePageRole(...roles: AppRole[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect("/forbidden");
  return user;
}

export const ROLE_HOME: Record<AppRole, string> = {
  CLIENT: "/dashboard/client",
  PROVIDER: "/dashboard/provider",
  ADMIN: "/admin",
};
