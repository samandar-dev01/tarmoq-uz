import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// Small secrets stored encrypted (AES-256-GCM) under a key made from AUTH_SECRET. Changing AUTH_SECRET makes them
// unreadable: people with two-step sign-in would have to set it up again (an admin can clear it in the database).

function key(purpose: string): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set to store secrets.");
  return Buffer.from(hkdfSync("sha256", secret, "", `tarmoq-${purpose}-v1`, 32));
}

export function seal(plain: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(purpose), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(".");
}

export function open(blob: string, purpose: string): string {
  const [version, iv, tag, body] = blob.split(".");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("Unreadable secret.");
  const decipher = createDecipheriv("aes-256-gcm", key(purpose), Buffer.from(iv, "base64"), { authTagLength: 16 });
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
}
