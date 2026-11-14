// Pure rules for the receipt a client uploads with "I paid" (no I/O, safe in the browser too), so they can be unit-tested.

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_MAX_MB = RECEIPT_MAX_BYTES / 1024 / 1024;

/** The one sentence for a file over the limit, used by the browser check and by the server. */
export const receiptTooBigMessage = `Fayl juda katta (eng koʻpi ${RECEIPT_MAX_MB} MB).`;

export type ReceiptType = { ext: "jpg" | "png" | "webp" | "pdf"; contentType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf" };

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b);

/**
 * What a file really is, read from its first bytes. The name and the type the browser reports are never trusted:
 * a renamed program or an SVG with a script in it must not be stored and later opened by an admin.
 */
export function detectReceiptType(bytes: Uint8Array): ReceiptType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { ext: "jpg", contentType: "image/jpeg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: "png", contentType: "image/png" };
  // WebP is "RIFF" + 4 size bytes + "WEBP".
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return { ext: "webp", contentType: "image/webp" };
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { ext: "pdf", contentType: "application/pdf" }; // "%PDF-"
  return null;
}

export type ReceiptCheck = { ok: true; type: ReceiptType } | { ok: false; status: 400 | 413; message: string };

/** Size first (cheap), then the real type. The messages are what the client reads. */
export function checkReceipt(bytes: Uint8Array): ReceiptCheck {
  if (bytes.length === 0) return { ok: false, status: 400, message: "Fayl boʻsh." };
  if (bytes.length > RECEIPT_MAX_BYTES) return { ok: false, status: 413, message: receiptTooBigMessage };
  const type = detectReceiptType(bytes);
  if (!type) return { ok: false, status: 400, message: "Chekni rasm (JPG, PNG, WebP) yoki PDF shaklida yuklang." };
  return { ok: true, type };
}
