import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { sendMail } from "./mail";
import { siteUrl } from "./site";

// One-time links sent by email. Only a hash of each token is stored, so the database alone can not use one.

export type TokenKind = "reset" | "verify";
const HOURS: Record<TokenKind, number> = { reset: 1, verify: 48 };
export const hashToken = (raw: string): string => createHash("sha256").update(raw).digest("hex");

export async function createToken(userId: string, kind: TokenKind): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  // A new link replaces the older ones of its kind.
  await prisma.authToken.deleteMany({ where: { userId, kind, usedAt: null } });
  await prisma.authToken.create({ data: { userId, kind, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + HOURS[kind] * 3_600_000) } });
  return raw;
}

/** Uses a token up: the user it belongs to, or null when it is unknown, used or out of date. */
export async function consumeToken(raw: string, kind: TokenKind, db: Prisma.TransactionClient = prisma): Promise<string | null> {
  const tokenHash = hashToken(raw);
  const claimed = await db.authToken.updateMany({ where: { tokenHash, kind, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return null;
  return (await db.authToken.findUnique({ where: { tokenHash }, select: { userId: true } }))?.userId ?? null;
}

/** Unused links of one account. Delete them when what they were made for (the address, the password) changes. */
export const unusedLinks = (userId: string, ...kinds: TokenKind[]) => ({ userId, usedAt: null, kind: { in: kinds } });

export async function sendVerifyLink(user: { id: string; email: string }): Promise<boolean> {
  const raw = await createToken(user.id, "verify");
  return sendMail(user.email, "Tarmoq.uz: emailni tasdiqlang", `Emailingizni tasdiqlash uchun havolani oching (48 soat amal qiladi):\n${siteUrl()}/verify?token=${raw}`);
}

export async function sendResetLink(user: { id: string; email: string }): Promise<boolean> {
  const raw = await createToken(user.id, "reset");
  return sendMail(user.email, "Tarmoq.uz: parolni tiklash", `Yangi parol oʻrnatish uchun havolani oching (1 soat amal qiladi):\n${siteUrl()}/reset?token=${raw}\n\nAgar buni siz soʻramagan boʻlsangiz, hech narsa qilmang.`);
}
