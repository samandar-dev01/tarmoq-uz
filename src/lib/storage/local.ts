import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import type { Readable } from "stream";

const base = () => path.resolve(process.env.LOCAL_UPLOAD_DIR ?? "./.uploads");

function resolveKey(key: string) {
  const full = path.resolve(base(), key);
  if (!full.startsWith(base() + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function put(key: string, data: Buffer) {
  const full = resolveKey(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

export async function remove(key: string) {
  await fs.rm(resolveKey(key), { force: true });
}

export async function size(key: string): Promise<number> {
  return (await fs.stat(resolveKey(key))).size;
}

export function read(key: string, range?: { start: number; end: number }): Readable {
  return createReadStream(resolveKey(key), range);
}
