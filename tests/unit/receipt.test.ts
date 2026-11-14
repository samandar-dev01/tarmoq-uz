import { describe, expect, it } from "vitest";
import { checkReceipt, detectReceiptType, RECEIPT_MAX_BYTES } from "@/lib/payments/receiptPure";

const bytes = (...b: number[]) => Uint8Array.from(b);
const ascii = (s: string) => Uint8Array.from(Buffer.from(s, "latin1"));
const pad = (head: Uint8Array, total = 64) => {
  const out = new Uint8Array(total);
  out.set(head);
  return out;
};

const JPEG = pad(bytes(0xff, 0xd8, 0xff, 0xe0));
const PNG = pad(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a));
const WEBP = pad(Uint8Array.from([...ascii("RIFF"), 0x24, 0, 0, 0, ...ascii("WEBP")]));
const PDF = pad(ascii("%PDF-1.7\n"));

describe("receipt type, read from the bytes", () => {
  it("accepts a JPEG, PNG, WebP and PDF", () => {
    expect(detectReceiptType(JPEG)).toEqual({ ext: "jpg", contentType: "image/jpeg" });
    expect(detectReceiptType(PNG)).toEqual({ ext: "png", contentType: "image/png" });
    expect(detectReceiptType(WEBP)).toEqual({ ext: "webp", contentType: "image/webp" });
    expect(detectReceiptType(PDF)).toEqual({ ext: "pdf", contentType: "application/pdf" });
  });

  it("rejects files that only look like receipts by name", () => {
    expect(detectReceiptType(pad(ascii("MZ\x90\x00")))).toBeNull(); // a Windows program
    expect(detectReceiptType(pad(ascii('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>')))).toBeNull();
    expect(detectReceiptType(pad(ascii("<!doctype html><script>1</script>")))).toBeNull();
    expect(detectReceiptType(pad(ascii("GIF89a")))).toBeNull();
    expect(detectReceiptType(pad(ascii("PK\x03\x04")))).toBeNull(); // a zip
  });

  it("does not take other RIFF files (such as WAV audio) for WebP", () => {
    expect(detectReceiptType(pad(Uint8Array.from([...ascii("RIFF"), 0x24, 0, 0, 0, ...ascii("WAVE")])))).toBeNull();
  });

  it("rejects a header that is cut short", () => {
    expect(detectReceiptType(bytes(0xff, 0xd8))).toBeNull();
    expect(detectReceiptType(ascii("%PDF"))).toBeNull();
    expect(detectReceiptType(ascii("RIFF....WEB"))).toBeNull();
    expect(detectReceiptType(new Uint8Array(0))).toBeNull();
  });
});

describe("receipt check", () => {
  it("passes a good receipt and says what it is", () => {
    const r = checkReceipt(PNG);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.type.contentType).toBe("image/png");
  });

  it("refuses an empty file with 400", () => {
    const r = checkReceipt(new Uint8Array(0));
    expect(r).toMatchObject({ ok: false, status: 400 });
  });

  it("refuses a file over the limit with 413, even when its type is fine", () => {
    const big = new Uint8Array(RECEIPT_MAX_BYTES + 1);
    big.set(JPEG);
    expect(checkReceipt(big)).toMatchObject({ ok: false, status: 413 });
    const exactlyAtLimit = new Uint8Array(RECEIPT_MAX_BYTES);
    exactlyAtLimit.set(JPEG);
    expect(checkReceipt(exactlyAtLimit).ok).toBe(true);
  });

  it("refuses a disguised file with 400 and a message the client can act on", () => {
    const r = checkReceipt(pad(ascii("MZ\x90\x00")));
    expect(r).toMatchObject({ ok: false, status: 400 });
    if (!r.ok) expect(r.message).toMatch(/JPG, PNG, WebP/);
  });
});
