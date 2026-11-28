import { z } from "zod";
import { requireUser, whileSignedIn } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { consumeToken } from "@/lib/authTokens";

const schema = z.object({ token: z.string().min(20).max(100) });

/**
 * Confirms an email address from its link. Sent by a button press, so a mail scanner that opens links uses nothing up.
 *
 * The person must be signed in to the account the link was made for: reading the email is not enough. The account may have
 * been made by a stranger using this address, and a confirmed address lets its password survive a later Google sign-in.
 */
export const POST = handle(async (req) => {
  await requireUser();
  const { token } = schema.parse(await readJson(req));
  await whileSignedIn(async (tx, userId) => {
    const owner = await consumeToken(token, "verify", tx);
    if (!owner) throw new HttpError(400, "Havola eskirgan yoki ishlatilgan. Yangisini soʻrang.");
    // Thrown inside the transaction, so the link is not used up.
    if (owner !== userId) throw new HttpError(403, "Bu havola boshqa hisob uchun. Tizimdan chiqib, oʻsha hisobga kiring.");
    await tx.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  });
  return ok({ ok: true });
});
