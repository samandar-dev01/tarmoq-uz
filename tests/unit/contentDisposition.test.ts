import { describe, expect, it } from "vitest";
import { contentDisposition } from "@/lib/storage/disposition";

// What the runtime does with the value: a header with a character above Latin-1 throws here, exactly as it did live.
const accepted = (value: string) => new Headers({ "Content-Disposition": value }).get("Content-Disposition");

describe("contentDisposition", () => {
  it("keeps a plain ASCII name as it is", () => {
    expect(contentDisposition("chek.png", false)).toBe('inline; filename="chek.png"');
    expect(contentDisposition("chek.pdf", true)).toBe('attachment; filename="chek.pdf"');
  });

  it("makes Cyrillic names safe and keeps the real name in filename*", () => {
    const value = contentDisposition("Чек.png", false);
    expect(value).toBe(`inline; filename="___.png"; filename*=UTF-8''%D0%A7%D0%B5%D0%BA.png`);
    expect(accepted(value)).toBe(value);
  });

  it("handles the Uzbek letter ʻ (U+02BB) and dashes that phones put in names", () => {
    const value = contentDisposition("toʻlov – chek.png", false);
    expect(value.startsWith('inline; filename="to_lov _ chek.png"; filename*=UTF-8\'\'')).toBe(true);
    expect(accepted(value)).toBe(value);
    expect(decodeURIComponent(value.split("filename*=UTF-8''")[1])).toBe("toʻlov – chek.png");
  });

  it("escapes the characters RFC 5987 does not allow unescaped", () => {
    expect(contentDisposition("Чек (1)*'.png", false)).toContain("%281%29%2A%27.png");
  });

  it("can not be used to break out of the header", () => {
    const value = contentDisposition('a".png\r\nSet-Cookie: x=1\\', true);
    expect(value).not.toMatch(/[\r\n]/);
    expect(value).toBe('attachment; filename="a.pngSet-Cookie: x=1"');
    expect(accepted(value)).toBe(value);
  });

  it("never produces an empty name", () => {
    expect(contentDisposition("", false)).toBe('inline; filename="file"');
    expect(contentDisposition('"\r\n"', false)).toBe('inline; filename="file"');
  });
});
