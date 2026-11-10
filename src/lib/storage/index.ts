import * as local from "./local";

export const isS3 = () => process.env.STORAGE_DRIVER === "s3";

export async function putFile(key: string, data: Buffer, contentType: string) {
  if (isS3()) return (await import("./s3")).put(key, data, contentType);
  return local.put(key, data);
}

export async function removeFile(key: string) {
  if (isS3()) return (await import("./s3")).remove(key);
  return local.remove(key);
}

export async function signedFileUrl(key: string, filename: string, contentType: string, download: boolean) {
  return (await import("./s3")).signedUrl(key, filename, contentType, download);
}

export { local as localStore };
