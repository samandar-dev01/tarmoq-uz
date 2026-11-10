import { requireRole } from "@/lib/auth";
import { handle, ok } from "@/lib/http";
import { getAdminStats } from "@/lib/adminStats";

export const GET = handle(async () => {
  await requireRole("ADMIN");
  return ok(await getAdminStats());
});
