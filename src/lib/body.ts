import { HttpError } from "./errors";

/**
 * Reads a request body but gives up the moment it passes `maxBytes`, so a huge or never-ending upload can
 * not fill the server's memory (the free instance has 512 MB). `Request.json()` and `Request.formData()` read
 * everything first and only then let the caller look at the size.
 *
 * The Content-Length header is a cheap early refusal, but it is only a claim, and a chunked upload has none,
 * so the bytes are counted as they arrive as well.
 */
export async function readBodyLimited(req: Request, maxBytes: number, tooBigMessage: string): Promise<Buffer> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, tooBigMessage);
  if (!req.body) return Buffer.alloc(0);

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new HttpError(413, tooBigMessage);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

/** A multipart form (an upload), read with the same size limit. `maxBytes` covers the file plus the form's own framing. */
export async function readFormLimited(req: Request, maxBytes: number, tooBigMessage: string): Promise<FormData> {
  const body = await readBodyLimited(req, maxBytes, tooBigMessage);
  const type = req.headers.get("content-type");
  const bad = () => new HttpError(400, "Soʻrov notoʻgʻri shaklda yuborildi.");
  if (!type) throw bad();
  try {
    return await new Response(body, { headers: { "content-type": type } }).formData();
  } catch {
    throw bad();
  }
}
