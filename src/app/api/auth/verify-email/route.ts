import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { consumeToken } from "@/lib/authTokens";

const schema = z.object({ token: z.string().min(20).max(100) });

/** Confirms an email address from its link. Sent by a button press, so a mail scanner that opens links uses nothing up. */
export const POST = handle(async (req) => {
  const { token } = schema.parse(await readJson(req));
  await prisma.$transaction(async (tx) => {
    const id = await consumeToken(token, "verify", tx);
    if (!id) throw new HttpError(400, "Havola eskirgan yoki ishlatilgan. Yangisini soʻrang.");
    await tx.user.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
  });
  return ok({ ok: true });
});
