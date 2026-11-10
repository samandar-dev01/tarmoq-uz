// S3-compatible storage (AWS S3, Cloudflare R2, MinIO, ...). Loaded only when STORAGE_DRIVER=s3.
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
    });
  }
  return client;
}

const bucket = () => {
  if (!process.env.S3_BUCKET) throw new Error("S3_BUCKET is not configured");
  return process.env.S3_BUCKET;
};

export async function put(key: string, data: Buffer, contentType: string) {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: data, ContentType: contentType }));
}

export async function remove(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function signedUrl(key: string, filename: string, contentType: string, download: boolean) {
  const safe = filename.replace(/["\r\n]/g, "");
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentType: contentType,
      ResponseContentDisposition: `${download ? "attachment" : "inline"}; filename="${safe}"`,
    }),
    { expiresIn: 300 },
  );
}
