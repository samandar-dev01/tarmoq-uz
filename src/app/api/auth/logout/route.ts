import { endSession } from "@/lib/auth";
import { handle, ok } from "@/lib/http";

export const POST = handle(async () => {
  endSession();
  return ok({ success: true });
});
