import { requireUser } from "@/lib/auth";
import { avatarUrl } from "@/lib/avatar";
import { handle, ok } from "@/lib/http";

export const GET = handle(async () => {
  const user = await requireUser();
  // Named field by field: nothing the database adds to a user later reaches the client by accident.
  return ok({ user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, avatarUrl: avatarUrl(user) } });
});
