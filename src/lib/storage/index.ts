import type { Readable } from "stream";
import * as local from "./local";
import type { StorageArea } from "./bucketPure";

export type { StorageArea };
export { contentDisposition } from "./disposition";
export const isS3 = () => process.env.STORAGE_DRIVER === "s3";

// `area` only matters for S3 (which bucket). Local storage keeps one folder; receipt keys already start with `receipts/`.
export async function putFile(key: string, data: Buffer, contentType: string, area: StorageArea = "deliveries") {
  if (isS3()) return (await import("./s3")).put(key, data, contentType, area);
  return local.put(key, data);
}

export async function removeFile(key: string, area: StorageArea = "deliveries") {
  if (isS3()) return (await import("./s3")).remove(key, area);
  return local.remove(key);
}

/** The bytes of a stored file as a stream, for a route that serves it itself (null: there is no such file). Works for both drivers. */
export async function readFile(key: string, area: StorageArea = "deliveries"): Promise<{ stream: Readable; size: number | null } | null> {
  if (isS3()) return (await import("./s3")).read(key, area);
  const size = await local.size(key).catch(() => null);
  return size === null ? null : { stream: local.read(key), size };
}

export async function signedFileUrl(key: string, filename: string, contentType: string, download: boolean, area: StorageArea = "deliveries") {
  return (await import("./s3")).signedUrl(key, filename, contentType, download, area);
}

export { local as localStore };
