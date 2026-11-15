// A Content-Disposition value that is safe in an HTTP header whatever the file name contains (no I/O: unit-tested).
//
// Header values may only hold Latin-1 characters, but clients' file names do not stay in that range: bank apps and
// phones produce Cyrillic names, and Uzbek Latin uses `ʻ` (U+02BB). A raw name in the header made the response throw
// ("Cannot convert argument to a ByteString"), so an admin could not open the receipt. So the plain `filename` is
// printable ASCII only, and the real name travels in `filename*` (RFC 5987/6266), which browsers prefer.

export function contentDisposition(filename: string, download: boolean): string {
  const type = download ? "attachment" : "inline";
  // Quotes, backslashes and control characters (CR/LF included) could break out of the header: drop them.
  const clean = filename.replace(/[\u0000-\u001f\u007f"\\]/g, "").trim() || "file";
  const ascii = clean.replace(/[^\u0020-\u007e]/g, "_");
  if (ascii === clean) return `${type}; filename="${ascii}"`;
  // encodeURIComponent leaves ' ( ) * alone, but RFC 5987 does not allow them unescaped.
  const encoded = encodeURIComponent(clean).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
