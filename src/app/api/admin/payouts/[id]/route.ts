import { requireRole } from "@/lib/auth";
import { handle, ok } from "@/lib/http";
import { markPayoutPaid } from "@/lib/payments/manual";

type Ctx = { params: { id: string } };

/** Admin sent the creator's money by hand and marks it paid. */
export const POST = handle(async (_req, { params }: Ctx) => {
  const admin = await requireRole("ADMIN");
  await markPayoutPaid(params.id, admin.id);
  return ok({ status: "PAID" });
});
