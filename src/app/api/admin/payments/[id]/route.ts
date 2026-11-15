import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/http";
import { confirmManualPayment, rejectManualPayment } from "@/lib/payments/manual";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ action: z.enum(["confirm", "reject"]) });

/** Admin decides a manual transfer: the money arrived (the order starts) or it did not (the client can try again). */
export const PATCH = handle(async (req, ctx: Ctx) => {
  const params = await ctx.params;
  const admin = await requireRole("ADMIN");
  const { action } = schema.parse(await readJson(req));
  if (action === "confirm") await confirmManualPayment(params.id, admin.id);
  else await rejectManualPayment(params.id, admin.id);
  return ok({ status: action === "confirm" ? "HELD" : "FAILED" });
});
