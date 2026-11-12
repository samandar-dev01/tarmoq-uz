import { prisma } from "@/lib/db";
import { hashPassword, startSession } from "@/lib/auth";
import { clientIp, handle, ok, readJson, HttpError } from "@/lib/http";
import { LIMITS, rateLimit, retryAfterSeconds } from "@/lib/rateLimit";
import { registerSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

export const POST = handle(async (req) => {
  // Every attempt counts, valid or not: 5 per IP per hour.
  const ipKey = `register:ip:${clientIp(req)}`;
  if (!rateLimit(ipKey, LIMITS.registerPerIp.limit, LIMITS.registerPerIp.windowMs)) {
    throw new HttpError(429, "Urinishlar juda koʻp. Birozdan keyin qayta urinib koʻring.", undefined, {
      "Retry-After": String(retryAfterSeconds(ipKey)),
    });
  }
  const input = registerSchema.parse(await readJson(req));

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new HttpError(409, "Bu email bilan hisob allaqachon mavjud.", { field: "email" });
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: input.role, // validated: CLIENT or PROVIDER only
      passwordHash: await hashPassword(input.password),
    },
    select: { id: true, name: true, role: true },
  });

  await logAudit({ actorId: user.id, action: "USER_REGISTERED", entity: "User", entityId: user.id });
  await startSession(user);
  return ok({ user }, 201);
});
