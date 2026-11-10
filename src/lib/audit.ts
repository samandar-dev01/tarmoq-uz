import { Prisma } from "@prisma/client";
import { prisma } from "./db";

export async function logAudit(entry: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  meta?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      meta: entry.meta,
    },
  });
}
