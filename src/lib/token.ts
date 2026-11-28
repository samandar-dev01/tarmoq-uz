// Edge-safe: used by proxy.ts (named middleware.ts before Next 16). Do not import Prisma or next/headers here.
import { SignJWT, jwtVerify } from "jose";

export type AppRole = "CLIENT" | "PROVIDER" | "ADMIN";
/**
 * `tv` is the token version: the number in `User.tokenVersion` when the session was issued. A password change or "sign out
 * everywhere" raises the user's number, so every older session stops matching (src/lib/auth.ts, getCurrentUser).
 * A session issued before this existed carries no `tv`; it reads as 0, which is what every account started with.
 */
export type SessionPayload = { sub: string; role: AppRole; name: string; tv: number };

const ROLES: AppRole[] = ["CLIENT", "PROVIDER", "ADMIN"];

// SECURITY FIX (vibeguard #11): 32+ characters (`openssl rand -base64 32` gives 44), and never the placeholder
// text from .env.example, which used to pass the old 16-character check.
const PLACEHOLDER = /change[-_ ]?me/i;

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32 || PLACEHOLDER.test(secret)) {
    throw new Error("AUTH_SECRET must be a random string of 32+ characters, not the placeholder (openssl rand -base64 32)");
  }
  return new TextEncoder().encode(secret);
}

// The same key signs the short-lived Google sign-in cookie (src/lib/googleAuth.ts), so the 32-character check lives in one place.
export { key as authKey };

export async function signToken(p: Omit<SessionPayload, "tv"> & { tv?: number }, maxAgeDays = 7): Promise<string> {
  return new SignJWT({ role: p.role, name: p.name, tv: p.tv ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeDays}d`)
    .sign(key());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.role !== "string") return null;
    if (!ROLES.includes(payload.role as AppRole)) return null;
    return { sub: payload.sub, role: payload.role as AppRole, name: String(payload.name ?? ""), tv: tokenVersionOf(payload.tv) };
  } catch {
    return null;
  }
}

/** The version a token claims: a whole number of 0 or more; a missing or odd value is 0 (the sessions made before versions existed). */
export const tokenVersionOf = (claim: unknown): number => (typeof claim === "number" && Number.isInteger(claim) && claim >= 0 ? claim : 0);

/** Whether a session issued at `claimed` is still the user's current one. */
export const sessionIsCurrent = (claimed: number, current: number): boolean => claimed === current;
