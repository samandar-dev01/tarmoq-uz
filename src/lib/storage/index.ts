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

export async function signedFileUrl(key: string, filename: string, contentType: string, download: boolean, area: StorageArea = "deliveries") {
  return (await import("./s3")).signedUrl(key, filename, contentType, download, area);
}

export { local as localStore };
