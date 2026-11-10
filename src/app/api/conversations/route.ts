import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/http";
import { listConversations } from "@/lib/messaging";

export const GET = handle(async () => {
  const user = await requireUser();
  const items = await listConversations(user.id);
  return ok({ conversations: items.map(({ sortKey, ...rest }) => rest) });
});
