// Which S3 bucket a file goes to (no I/O, so it can be unit-tested).
//
// Delivered videos and clients' bank receipts live in separate buckets, so each bucket can accept only its own file
// types and size (on Supabase: videos only, up to 25 MB, and JPG/PNG/WebP/PDF only, up to 5 MB). A storage bucket that
// refuses a type answers 415, and the app can not store that file there.

export type StorageArea = "deliveries" | "receipts";

/**
 * The bucket name for an area. Receipts use `S3_RECEIPTS_BUCKET`; when it is not set they share `S3_BUCKET`, which is
 * how a plain single-bucket store (AWS S3, R2, MinIO with no type limits) keeps working unchanged.
 * Returns null when nothing is configured.
 */
export function bucketFor(area: StorageArea, env: Record<string, string | undefined> = process.env): string | null {
  const shared = env.S3_BUCKET?.trim() || null;
  if (area === "receipts") return env.S3_RECEIPTS_BUCKET?.trim() || shared;
  return shared;
}
