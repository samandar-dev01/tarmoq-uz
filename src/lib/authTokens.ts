import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { sendMail } from "./mail";
import { siteUrl } from "./site";

// One-time links sent by email. Only a hash of each token is stored, so the database alone can not use one.

export type TokenKind = "reset" | "verify";
const HOURS: Record<TokenKind, number> = { reset: 1, verify: 48 };
export const hashToken = (raw: string): string => createHash("sha256").update(raw).digest("hex");

/**
 * A new link for `email`, the address it is about to be sent to. Null when the account no longer has that address (it was
 * changed while the link was being asked for): a link must never reach an address the account has left.
 */
export async function createToken(userId: string, kind: TokenKind, email: string): Promise<string | null> {
  const raw = randomBytes(32).toString("base64url");
  return prisma.$transaction(async (tx) => {
    // Keeps the address from changing until the link is saved. A change made before this finds no row here; one made
    // after it deletes this link.
    const same = await tx.$queryRaw<unknown[]>`SELECT 1 FROM "User" WHERE "id" = ${userId} AND "email" = ${email} FOR KEY SHARE`;
    if (same.length !== 1) return null;
    // A new link replaces the older ones of its kind.
    await tx.authToken.deleteMany({ where: { userId, kind, usedAt: null } });
    await tx.authToken.create({ data: { userId, kind, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + HOURS[kind] * 3_600_000) } });
    return raw;
  });
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
  const raw = await createToken(user.id, "verify", user.email);
  if (!raw) return false;
  return sendMail(user.email, "Tarmoq.uz: emailni tasdiqlang", `Emailingizni tasdiqlash uchun havolani oching (48 soat amal qiladi):\n${siteUrl()}/verify?token=${raw}`);
}

export async function sendResetLink(user: { id: string; email: string }): Promise<boolean> {
  const raw = await createToken(user.id, "reset", user.email);
  if (!raw) return false;
  return sendMail(user.email, "Tarmoq.uz: parolni tiklash", `Yangi parol oʻrnatish uchun havolani oching (1 soat amal qiladi):\n${siteUrl()}/reset?token=${raw}\n\nAgar buni siz soʻramagan boʻlsangiz, hech narsa qilmang.`);
}
