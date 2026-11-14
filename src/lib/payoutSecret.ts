import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * A creator's payout card number is stored encrypted (AES-256-GCM), never in the clear. Only the last 4 digits
 * are kept readable, for the creator's own page. Decrypting is for the admin payouts page alone.
 *
 * The key is PAYOUT_ENCRYPTION_KEY (32 random bytes, base64: `openssl rand -base64 32`). Until that is set, a key
 * is derived from AUTH_SECRET, so nothing new is needed to start. Changing either key later makes the stored
 * numbers unreadable, so creators would have to enter their card again.
 */

const VERSION = "v1";

function key(): Buffer {
  const explicit = process.env.PAYOUT_ENCRYPTION_KEY?.trim();
  if (explicit) {
    const k = Buffer.from(explicit, "base64");
    if (k.length !== 32) throw new Error("PAYOUT_ENCRYPTION_KEY must be 32 bytes, base64 encoded.");
    return k;
  }
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Set PAYOUT_ENCRYPTION_KEY (or AUTH_SECRET) to store payout cards.");
  return Buffer.from(hkdfSync("sha256", secret, "", "tarmoq-payout-card-v1", 32));
}

export function encryptCard(digits: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(digits, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(".");
}

export function decryptCard(blob: string): string {
  const [version, iv, tag, body] = blob.split(".");
  if (version !== VERSION || !iv || !tag || !body) throw new Error("Unknown payout card format.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
}
