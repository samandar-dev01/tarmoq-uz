import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, clientIp, handle, ok, readJson } from "@/lib/http";
import { mailEnabled } from "@/lib/mail";
import { sendResetLink } from "@/lib/authTokens";
import { rateLimit } from "@/lib/rateLimit";

const schema = z.object({ email: z.string().trim().toLowerCase().email("Email manzilini toʻgʻri kiriting") });

/** Sends a reset link. The answer is the same whether or not the address has an account. */
export const POST = handle(async (req) => {
  if (!mailEnabled()) throw new HttpError(404, "Topilmadi.");
  const { email } = schema.parse(await readJson(req));
  if (!rateLimit(`forgot:ip:${clientIp(req)}`, 5, 60 * 60 * 1000) || !rateLimit(`forgot:email:${email}`, 3, 60 * 60 * 1000)) {
    throw new HttpError(429, "Urinishlar juda koʻp. Birozdan keyin qayta urinib koʻring.");
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, isActive: true, passwordHash: true } });
  // Not awaited, so the time the answer takes says nothing either. An account made through Google has no password to reset.
  if (user?.isActive && user.passwordHash) void sendResetLink(user).catch((e) => console.error("Reset link failed:", e));
  return ok({ ok: true });
});
