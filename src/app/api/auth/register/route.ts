import { prisma } from "@/lib/db";
import { hashPassword, startSession } from "@/lib/auth";
import { handle, ok, readJson, HttpError } from "@/lib/http";
import { registerSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

export const POST = handle(async (req) => {
  const input = registerSchema.parse(await readJson(req));

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new HttpError(409, "An account with this email already exists.", { field: "email" });
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
