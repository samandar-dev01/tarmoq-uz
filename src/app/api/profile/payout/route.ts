import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";
import { cleanCardNumber, isValidCardNumber } from "@/lib/cardFormat";
import { encryptCard } from "@/lib/payoutSecret";

const schema = z.object({
  holder: z.string().trim().min(3, "Karta egasining ismini kiriting").max(80),
  cardNumber: z
    .string()
    .trim()
    .min(1, "Karta raqamini kiriting")
    .max(30)
    .refine((v) => isValidCardNumber(cleanCardNumber(v)), "Karta raqamini toʻgʻri kiriting (16 ta raqam)"),
});

/** The creator saves the card their earnings are sent to. The number is stored encrypted; only the last 4 digits stay readable. */
export const PUT = handle(async (req) => {
  const user = await requireRole("PROVIDER");
  if (!rateLimit(`payout-card:${user.id}`, 10, 15 * 60 * 1000)) throw new HttpError(429, "Juda koʻp urinish. Bir necha daqiqa kuting.");
  const { holder, cardNumber } = schema.parse(await readJson(req));

  const digits = cleanCardNumber(cardNumber);
  const profile = await prisma.providerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!profile) throw new HttpError(409, "Avval profilingizni yarating.");

  const last4 = digits.slice(-4);
  await prisma.providerProfile.update({
    where: { id: profile.id },
    data: { payoutHolder: holder, payoutCardEnc: encryptCard(digits), payoutCardLast4: last4 },
  });
  await logAudit({ actorId: user.id, action: "PAYOUT_CARD_SAVED", entity: "ProviderProfile", entityId: profile.id, meta: { last4 } });
  return ok({ last4 });
});
