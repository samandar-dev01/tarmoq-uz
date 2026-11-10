import { z } from "zod";
import type { ProfileStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError, handle, ok, readJson } from "@/lib/http";
import { logAudit } from "@/lib/audit";

type Ctx = { params: { id: string } };
const schema = z.object({ action: z.enum(["approve", "reject", "suspend", "reinstate"]) });

const RULES: Record<string, { from: ProfileStatus[]; to: ProfileStatus }> = {
  approve: { from: ["PENDING_REVIEW"], to: "APPROVED" },
  reject: { from: ["PENDING_REVIEW"], to: "DRAFT" }, // sent back to the provider for edits
  suspend: { from: ["APPROVED", "PENDING_REVIEW"], to: "SUSPENDED" },
  reinstate: { from: ["SUSPENDED"], to: "APPROVED" },
};

export const PATCH = handle(async (req, { params }: Ctx) => {
  const admin = await requireRole("ADMIN");
  const { action } = schema.parse(await readJson(req));
  const rule = RULES[action]!;

  const profile = await prisma.providerProfile.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!profile) throw new HttpError(404, "Provider profile not found.");
  if (action === "approve" || action === "reinstate") {
    if ((await prisma.service.count({ where: { profileId: params.id, isActive: true } })) === 0) {
      throw new HttpError(422, "This profile has no active packages, so it cannot go live.");
    }
  }
  const moved = await prisma.providerProfile.updateMany({
    where: { id: params.id, status: { in: rule.from } },
    data: { status: rule.to, ...(action === "reject" ? { wizardStep: 5 } : {}) },
  });
  if (moved.count !== 1) throw new HttpError(409, "The profile is not in a state that allows this action.");

  await logAudit({ actorId: admin.id, action: `PROVIDER_${action.toUpperCase()}`, entity: "ProviderProfile", entityId: params.id });
  return ok({ status: rule.to });
});
