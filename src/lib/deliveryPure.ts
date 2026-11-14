// Pure rules for the video a creator delivers (no I/O, so they can be unit-tested).

export type VideoFamily = "mp4" | "webm";

/** File extension -> what the file has to be inside, and the content type the app serves it as. */
export const VIDEO_EXTENSIONS: Record<string, { family: VideoFamily; contentType: string }> = {
  ".mp4": { family: "mp4", contentType: "video/mp4" },
  ".m4v": { family: "mp4", contentType: "video/x-m4v" },
  ".mov": { family: "mp4", contentType: "video/quicktime" },
  ".webm": { family: "webm", contentType: "video/webm" },
};

const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));

/**
 * What a file really is, read from its first bytes. SECURITY FIX (vibeguard #10): the name and the type the
 * browser reports are only claims, so a text file renamed `.mp4` used to be accepted.
 *  - MP4, M4V and MOV all start with a box: 4 size bytes, then its name. Nearly always `ftyp`; very old QuickTime
 *    files can open with `moov`, `mdat`, `free`, `skip` or `wide` instead.
 *  - WebM starts with the EBML marker 1A 45 DF A3.
 */
export function detectVideoFamily(bytes: Uint8Array): VideoFamily | null {
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  if (bytes.length >= 12 && ["ftyp", "moov", "mdat", "free", "skip", "wide"].includes(ascii(bytes, 4, 8))) return "mp4";
  return null;
}

/** True when the extension is a video one and the bytes agree with it. */
export function videoMatchesExtension(ext: string, bytes: Uint8Array): boolean {
  const wanted = VIDEO_EXTENSIONS[ext.toLowerCase()];
  return !!wanted && detectVideoFamily(bytes) === wanted.family;
}
