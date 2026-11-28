import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { HttpError, clientIp, handle, ok, readJson } from "@/lib/http";
import { consumeToken } from "@/lib/authTokens";
import { rateLimit } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  token: z.string().min(20).max(100),
  password: z.string().min(8, "Parol kamida 8 ta belgidan iborat boʻlsin").max(72, "Parol 72 ta belgidan oshmasin"),
});

/** A new password from a reset link. Every session of the account ends; the person signs in with the new password. */
export const POST = handle(async (req) => {
  if (!rateLimit(`reset:ip:${clientIp(req)}`, 10, 60 * 60 * 1000)) throw new HttpError(429, "Urinishlar juda koʻp. Birozdan keyin qayta urinib koʻring.");
  const { token, password } = schema.parse(await readJson(req));
  const passwordHash = await hashPassword(password);
  const userId = await prisma.$transaction(async (tx) => {
    const id = await consumeToken(token, "reset", tx);
    if (!id) throw new HttpError(400, "Havola eskirgan yoki ishlatilgan. Yangisini soʻrang.");
    // Opening the link also proves the address.
    await tx.user.update({ where: { id }, data: { passwordHash, tokenVersion: { increment: 1 }, emailVerifiedAt: new Date() } });
    return id;
  });
  await logAudit({ actorId: userId, action: "PASSWORD_RESET", entity: "User", entityId: userId });
  return ok({ ok: true });
});
