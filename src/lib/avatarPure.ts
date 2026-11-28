// Pure rules for a profile photo (no I/O, safe in the browser too), so they can be unit-tested.
// The type is read from the first bytes exactly as for a bank receipt (src/lib/payments/receiptPure.ts), without the PDF.
import { tk } from "../i18n/dictionary";
import { detectReceiptType } from "./payments/receiptPure";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MAX_MB = AVATAR_MAX_BYTES / 1024 / 1024;
/** What the browser makes of a chosen photo before it is sent: a centred square, this many pixels on a side. */
export const AVATAR_SIZE_PX = 512;

export type AvatarType = { ext: "jpg" | "png" | "webp"; contentType: "image/jpeg" | "image/png" | "image/webp" };

/** What a file really is, from its first bytes. The name and the type the browser reports are never trusted. A PDF is not a photo. */
export function detectAvatarType(bytes: Uint8Array): AvatarType | null {
  const type = detectReceiptType(bytes);
  if (!type || type.ext === "pdf") return null;
  return { ext: type.ext, contentType: type.contentType as AvatarType["contentType"] };
}

/** The content type a stored photo is served with, from the extension WE gave its key (never from anything a visitor sent). */
export function avatarContentType(key: string): AvatarType["contentType"] | null {
  const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  return ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : null;
}

export const avatarKeyFor = (userId: string, uuid: string, ext: AvatarType["ext"]) => `avatars/${userId.replace(/[^\w-]/g, "")}/${uuid}.${ext}`;

export type AvatarCheck = { ok: true; type: AvatarType } | { ok: false; status: 400 | 413; message: string; max?: number };

/**
 * Size first (cheap), then the real type. `message` is Uzbek, as every server sentence (`tk` only marks it for the
 * translation test); the route fills its `{max}` with `max` through `msg`, and `handle()` puts it into the reader's language.
 */
export function checkAvatar(bytes: Uint8Array): AvatarCheck {
  if (bytes.length === 0) return { ok: false, status: 400, message: tk("Rasm fayli boʻsh.") };
  if (bytes.length > AVATAR_MAX_BYTES) return { ok: false, status: 413, message: tk("Rasm juda katta (eng koʻpi {max} MB)."), max: AVATAR_MAX_MB };
  const type = detectAvatarType(bytes);
  if (!type) return { ok: false, status: 400, message: tk("Rasmni JPG, PNG yoki WebP shaklida yuklang.") };
  return { ok: true, type };
}
