import { requireRole } from "@/lib/auth";
import { clientIp, handle, ok, readJson } from "@/lib/http";
import { proposeTerms, termsSchema } from "@/lib/terms";

type Ctx = { params: Promise<{ id: string }> };

/** Provider sends (or re-sends) the terms. The provider's acceptance is recorded immediately. */
export const POST = handle(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireRole("PROVIDER");
  const input = termsSchema.parse(await readJson(req));
  const agreement = await proposeTerms({ orderId: id, userId: user.id, by: "provider", input, ip: clientIp(req) });
  return ok({ agreement: { id: agreement.id, version: agreement.version, termsHash: agreement.termsHash } }, 201);
});
