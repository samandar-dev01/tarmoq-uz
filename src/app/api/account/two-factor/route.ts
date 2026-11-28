import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, whileSignedIn } from "@/lib/auth";
import { requireCurrentPassword } from "@/lib/accountGuard";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { newSecret, otpauthUrl, totpMatches } from "@/lib/totp";
import { open, seal } from "@/lib/secretBox";
import { rateLimit } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setup"), currentPassword: z.string().min(1, "Joriy parolni kiriting").max(200) }),
  z.object({ action: z.literal("enable"), code: z.string().trim().min(6, "6 xonali kodni kiriting").max(10) }),
  z.object({ action: z.literal("disable"), code: z.string().trim().min(6, "6 xonali kodni kiriting").max(10), currentPassword: z.string().min(1, "Joriy parolni kiriting").max(200) }),
]);
const WRONG = "Kod notoʻgʻri. Ilovadagi yangi kodni kiriting.";

/**
 * Two-step sign-in: `setup` makes a secret for the authenticator app (not yet on), `enable` turns it on once a code
 * from the app is right, `disable` turns it off with the password and a code.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  if (!rateLimit(`totp:${user.id}`, 15, 15 * 60 * 1000)) throw new HttpError(429, "Juda koʻp urinish. Bir necha daqiqa kuting.");
  const input = schema.parse(await readJson(req));
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpSecretEnc: true, totpEnabledAt: true } });

  if (input.action === "setup") {
    await requireCurrentPassword(user.id, input.currentPassword);
    if (row.totpEnabledAt) throw new HttpError(409, "Ikki bosqichli kirish allaqachon yoqilgan.");
    const secret = newSecret();
    await whileSignedIn((tx) => tx.user.update({ where: { id: user.id }, data: { totpSecretEnc: seal(secret, "totp") } }));
    return ok({ secret, url: otpauthUrl(secret, user.email) });
  }
  if (!row.totpSecretEnc) throw new HttpError(409, "Avval sozlashni boshlang.");
  if (input.action === "disable") await requireCurrentPassword(user.id, input.currentPassword);
  if (!totpMatches(open(row.totpSecretEnc, "totp"), input.code)) throw new HttpError(400, WRONG, { field: "code" });
  await whileSignedIn((tx) =>
    tx.user.update({
      where: { id: user.id },
      data: input.action === "enable" ? { totpEnabledAt: new Date() } : { totpEnabledAt: null, totpSecretEnc: null },
    }),
  );
  await logAudit({ actorId: user.id, action: input.action === "enable" ? "TWO_FACTOR_ON" : "TWO_FACTOR_OFF", entity: "User", entityId: user.id });
  return ok({ enabled: input.action === "enable" });
});
