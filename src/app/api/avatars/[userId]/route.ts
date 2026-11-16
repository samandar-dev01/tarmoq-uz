import { Readable } from "stream";
import { prisma } from "@/lib/db";
import { avatarContentType } from "@/lib/avatarPure";
import { HttpError, handle } from "@/lib/http";
import { readFile } from "@/lib/storage";

type Ctx = { params: Promise<{ userId: string }> };

// A new photo is a new address (`?v=<avatarUpdatedAt>` is only a cache-buster, the server ignores it), so the browser may keep
// each one for ever. A missing photo is NOT cached: the person may add one a minute later.
const NOT_FOUND = () => new HttpError(404, "Topilmadi.", undefined, { "Cache-Control": "no-store" });

/**
 * A person's profile photo, streamed through the app. It is not secret (a profile picture is shown to anyone who can see
 * the person), but nothing else is reachable from here: only this one file, found by the user's id, served with the
 * content type WE chose when it was stored, and `nosniff` so a browser never reinterprets it.
 */
export const GET = handle(async (_req, ctx: Ctx) => {
  const { userId } = await ctx.params;
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { avatarKey: true, isActive: true } });
  if (!row?.avatarKey || !row.isActive) throw NOT_FOUND();
  const contentType = avatarContentType(row.avatarKey);
  if (!contentType) throw NOT_FOUND();
  const file = await readFile(row.avatarKey, "avatars");
  if (!file) throw NOT_FOUND();

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  };
  if (file.size !== null) headers["Content-Length"] = String(file.size);
  return new Response(Readable.toWeb(file.stream) as unknown as ReadableStream, { headers });
});
