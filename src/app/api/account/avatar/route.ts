import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { limitAccountAction } from "@/lib/accountGuard";
import { logAudit } from "@/lib/audit";
import { avatarKeyFor, AVATAR_MAX_BYTES, AVATAR_MAX_MB, checkAvatar } from "@/lib/avatarPure";
import { avatarUrl } from "@/lib/avatar";
import { msg } from "@/i18n/dictionary";
import { readFormLimited } from "@/lib/body";
import { HttpError, handle, ok } from "@/lib/http";
import { putFile, removeFile } from "@/lib/storage";

/** The old photo is removed after the new one is saved; a failure there only leaves one stray file, never a broken profile. */
const dropQuietly = (key: string | null | undefined) =>
  key ? removeFile(key, "avatars").catch((e) => console.error("Could not remove an old profile photo:", e)) : undefined;

/**
 * Sets the person's photo (multipart, field `photo`). The browser has already cropped it to a 512 px square WebP when it
 * can; whatever arrives is checked again here: at most 2 MB, and its type is read from its first bytes (JPG, PNG, WebP), never
 * from the file's name or the type the browser claims. The file is stored under a key we make, so the name never reaches storage.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  limitAccountAction("avatar", user.id);

  // The body is counted while it is read (the form adds a little to the file's own size).
  const form = await readFormLimited(req, AVATAR_MAX_BYTES + 100_000, msg("Rasm juda katta (eng koʻpi {max} MB).", { max: AVATAR_MAX_MB }));
  const file = form.get("photo");
  if (!(file instanceof File)) throw new HttpError(400, "Rasm tanlang.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const checked = checkAvatar(bytes);
  if (!checked.ok) throw new HttpError(checked.status, msg(checked.message, { max: checked.max ?? 0 }));

  const key = avatarKeyFor(user.id, randomUUID(), checked.type.ext);
  try {
    await putFile(key, bytes, checked.type.contentType, "avatars");
  } catch (e) {
    // The bucket is missing, unreachable or full. Say so plainly; the details stay in the server log.
    console.error("Could not store a profile photo:", e);
    throw new HttpError(503, "Rasmni hozir saqlab boʻlmadi. Birozdan keyin qayta urinib koʻring.");
  }

  const before = await prisma.user.findUnique({ where: { id: user.id }, select: { avatarKey: true } });
  let saved;
  try {
    saved = await prisma.user.update({ where: { id: user.id }, data: { avatarKey: key, avatarUpdatedAt: new Date() }, select: { id: true, avatarUpdatedAt: true } });
  } catch (e) {
    await dropQuietly(key); // the file belongs to nobody now
    throw e;
  }
  await dropQuietly(before?.avatarKey);
  await logAudit({ actorId: user.id, action: "AVATAR_CHANGED", entity: "User", entityId: user.id, meta: { bytes: bytes.length, type: checked.type.contentType } });
  return ok({ avatarUrl: avatarUrl(saved) });
});

/** Removes the photo: the person is shown by their initials again. */
export const DELETE = handle(async () => {
  const user = await requireUser();
  limitAccountAction("edit", user.id);
  const before = await prisma.user.findUnique({ where: { id: user.id }, select: { avatarKey: true } });
  await prisma.user.update({ where: { id: user.id }, data: { avatarKey: null, avatarUpdatedAt: null } });
  await dropQuietly(before?.avatarKey);
  if (before?.avatarKey) await logAudit({ actorId: user.id, action: "AVATAR_REMOVED", entity: "User", entityId: user.id });
  return ok({ avatarUrl: null });
});
