/**
 * The only accepted `next=` targets are paths on this site: one leading slash, then anything but a second
 * slash or a backslash (browsers read `/\host` as `//host`). Control characters are refused too, because
 * browsers strip tabs and newlines from URLs, which would turn `/\t/host` into `//host`.
 * Everything else (`//evil.com`, `https://…`, `javascript:…`) comes back as null.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (next[0] !== "/") return null;
  if (next[1] === "/" || next[1] === "\\") return null;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return null;
  return next;
}
