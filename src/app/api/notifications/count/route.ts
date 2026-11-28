import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/http";
import { unreadCounts } from "@/lib/notifications";

/** The header's badges, asked again from time to time while a page is open. */
export const GET = handle(async () => ok(await unreadCounts((await requireUser()).id)));
