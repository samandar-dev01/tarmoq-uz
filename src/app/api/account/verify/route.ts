import { requireUser } from "@/lib/auth";
import { HttpError, handle, ok } from "@/lib/http";
import { mailEnabled } from "@/lib/mail";
import { sendVerifyLink } from "@/lib/authTokens";
import { rateLimit } from "@/lib/rateLimit";

/** Sends the confirmation link again. */
export const POST = handle(async () => {
  const user = await requireUser();
  if (!mailEnabled()) throw new HttpError(404, "Topilmadi.");
  if (!rateLimit(`verify:${user.id}`, 3, 60 * 60 * 1000)) throw new HttpError(429, "Urinishlar juda koʻp. Birozdan keyin qayta urinib koʻring.");
  if (!(await sendVerifyLink(user))) throw new HttpError(503, "Xatni hozir yuborib boʻlmadi. Birozdan keyin qayta urinib koʻring.");
  return ok({ ok: true });
});
