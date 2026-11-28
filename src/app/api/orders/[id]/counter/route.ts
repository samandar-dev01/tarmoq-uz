import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { clientIp, handle, ok, readJson } from "@/lib/http";
import { proposeTerms, termsSchema } from "@/lib/terms";

type Ctx = { params: Promise<{ id: string }> };

/** The client asks for different terms before paying: a new version they have accepted, waiting for the creator. */
export const POST = handle(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireRole("CLIENT");
  const input: z.infer<typeof termsSchema> = termsSchema.parse(await readJson(req));
  const agreement = await proposeTerms({ orderId: id, userId: user.id, by: "client", input, ip: clientIp(req) });
  return ok({ agreement: { id: agreement.id, version: agreement.version, termsHash: agreement.termsHash } }, 201);
});
