// Edge-safe: used by middleware.ts. Do not import Prisma or next/headers here.
import { SignJWT, jwtVerify } from "jose";

export type AppRole = "CLIENT" | "PROVIDER" | "ADMIN";
export type SessionPayload = { sub: string; role: AppRole; name: string };

const ROLES: AppRole[] = ["CLIENT", "PROVIDER", "ADMIN"];

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set to a random string of 16+ characters");
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
