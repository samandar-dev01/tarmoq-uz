// S3-compatible storage (AWS S3, Cloudflare R2, MinIO, ...). Loaded only when STORAGE_DRIVER=s3.
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "stream";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { bucketFor, type StorageArea } from "./bucketPure";
import { contentDisposition } from "./disposition";

let client: S3Client | null = null;

function s3() {
  if (!client) {
    const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
    if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) throw new Error("S3 credentials are not configured");
    client = new S3Client({
      region: S3_REGION || "auto",
      endpoint: S3_ENDPOINT || undefined,
      forcePathStyle: !!S3_ENDPOINT,
      credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
      // Newer SDK versions add a CRC32 checksum to every request by default, which some S3-compatible stores
      // refuse. Ask for one only when the operation requires it, as older versions did.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

const bucket = (area: StorageArea) => {
  const name = bucketFor(area); // throws, with the variable's name, for an area that has its own bucket and none set
  if (!name) throw new Error(area === "receipts" ? "S3_RECEIPTS_BUCKET (or S3_BUCKET) is not configured" : "S3_BUCKET is not configured");
  return name;
};

export async function put(key: string, data: Buffer, contentType: string, area: StorageArea = "deliveries") {
  await s3().send(new PutObjectCommand({ Bucket: bucket(area), Key: key, Body: data, ContentType: contentType }));
}

export async function remove(key: string, area: StorageArea = "deliveries") {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(area), Key: key }));
}

export async function signedUrl(key: string, filename: string, contentType: string, download: boolean, area: StorageArea = "deliveries") {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(area),
      Key: key,
      ResponseContentType: contentType,
      ResponseContentDisposition: contentDisposition(filename, download),
    }),
    { expiresIn: 300 },
  );
}

/** The bytes of one object, to be streamed through the app (profile photos: public, small, and cached for a year by the browser). Null when there is no such object. */
export async function read(key: string, area: StorageArea): Promise<{ stream: Readable; size: number | null } | null> {
  try {
    const out = await s3().send(new GetObjectCommand({ Bucket: bucket(area), Key: key }));
    if (!out.Body) return null;
    return { stream: out.Body as Readable, size: typeof out.ContentLength === "number" ? out.ContentLength : null };
  } catch (e) {
    if ((e as { name?: string }).name === "NoSuchKey") return null;
    throw e;
  }
}
