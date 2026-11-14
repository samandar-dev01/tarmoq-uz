// Edge-safe: used by middleware.ts. Do not import Prisma or next/headers here.
import { SignJWT, jwtVerify } from "jose";

export type AppRole = "CLIENT" | "PROVIDER" | "ADMIN";
export type SessionPayload = { sub: string; role: AppRole; name: string };

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

export async function signToken(p: SessionPayload, maxAgeDays = 7): Promise<string> {
  return new SignJWT({ role: p.role, name: p.name })
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
    return { sub: payload.sub, role: payload.role as AppRole, name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}
