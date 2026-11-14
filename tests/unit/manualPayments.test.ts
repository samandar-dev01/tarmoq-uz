import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptCard, encryptCard } from "@/lib/payoutSecret";
import { cleanCardNumber, formatCardNumber, isValidCardNumber, maskCard } from "@/lib/cardFormat";
import { manualInstructions, orderReference } from "@/lib/payments/manualPure";
import { paymentClaimedMessage } from "@/lib/notify";

const ENV_KEYS = ["AUTH_SECRET", "PAYOUT_ENCRYPTION_KEY", "APP_URL", "RENDER_EXTERNAL_URL"] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  process.env.AUTH_SECRET = "test-secret-for-unit-tests";
  delete process.env.PAYOUT_ENCRYPTION_KEY;
  delete process.env.APP_URL;
  delete process.env.RENDER_EXTERNAL_URL;
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("payout card encryption", () => {
  const card = "4111111111111111";

  it("round-trips, and the stored text never contains the number", () => {
    const blob = encryptCard(card);
    expect(blob).not.toContain(card);
    expect(blob).not.toContain(card.slice(-8));
    expect(decryptCard(blob)).toBe(card);
  });

  it("uses a new random IV each time, so the same card never stores the same text twice", () => {
    expect(encryptCard(card)).not.toBe(encryptCard(card));
  });

  it("round-trips with an explicit 32-byte key and refuses a key of the wrong length", () => {
    process.env.PAYOUT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    expect(decryptCard(encryptCard(card))).toBe(card);
    process.env.PAYOUT_ENCRYPTION_KEY = Buffer.alloc(16, 7).toString("base64");
    expect(() => encryptCard(card)).toThrow(/32 bytes/);
  });

  it("cannot be read with a different key", () => {
    const blob = encryptCard(card);
    process.env.PAYOUT_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    expect(() => decryptCard(blob)).toThrow();
  });

  it("detects tampering and unknown formats", () => {
    const [v, iv, tag, body] = encryptCard(card).split(".");
    const flipped = Buffer.from(body!, "base64");
    flipped[0] = flipped[0]! ^ 1;
    expect(() => decryptCard([v, iv, tag, flipped.toString("base64")].join("."))).toThrow();
    expect(() => decryptCard("v9.a.b.c")).toThrow(/format/);
    expect(() => decryptCard("garbage")).toThrow(/format/);
  });

  it("refuses to run with no key material at all", () => {
    delete process.env.AUTH_SECRET;
    expect(() => encryptCard(card)).toThrow(/PAYOUT_ENCRYPTION_KEY/);
  });
});

describe("card number checks", () => {
  it("accepts a 16-digit number with a correct check digit", () => {
    expect(isValidCardNumber("4111111111111111")).toBe(true);
    expect(isValidCardNumber("4242424242424242")).toBe(true);
  });

  it("rejects a typo, a wrong length and non-digits", () => {
    expect(isValidCardNumber("4111111111111112")).toBe(false);
    expect(isValidCardNumber("411111111111111")).toBe(false);
    expect(isValidCardNumber("41111111111111111")).toBe(false);
    expect(isValidCardNumber("4111 1111 1111 1111")).toBe(false); // clean it first
    expect(isValidCardNumber("abcdabcdabcdabcd")).toBe(false);
    expect(isValidCardNumber("")).toBe(false);
  });

  it("cleans, groups and masks", () => {
    expect(cleanCardNumber("4111 1111-1111 1111")).toBe("4111111111111111");
    expect(formatCardNumber("4111111111111111")).toBe("4111 1111 1111 1111");
    expect(maskCard("1111")).toBe("•••• •••• •••• 1111");
  });
});

describe("manual transfer helpers", () => {
  it("makes the order code from the end of the id, upper-case, 6 characters", () => {
    expect(orderReference("clx0abc123def456ghi")).toBe("456GHI");
    expect(orderReference("ab")).toBe("AB");
  });

  it("gives instructions only when both the card and the holder are set", () => {
    expect(manualInstructions({})).toBeNull();
    expect(manualInstructions({ MANUAL_PAY_CARD: "8600 1234 5678 9012" })).toBeNull();
    expect(manualInstructions({ MANUAL_PAY_CARD: "  ", MANUAL_PAY_HOLDER: "A B" })).toBeNull();
    expect(manualInstructions({ MANUAL_PAY_CARD: " 8600 1234 5678 9012 ", MANUAL_PAY_HOLDER: " A B " })).toEqual({
      card: "8600 1234 5678 9012", holder: "A B", bank: null,
    });
    expect(manualInstructions({ MANUAL_PAY_CARD: "1", MANUAL_PAY_HOLDER: "A", MANUAL_PAY_BANK: " Kapital " })?.bank).toBe("Kapital");
  });
});

describe("payment claimed alert", () => {
  it("carries the amount and the order code and a link, and nothing about people", () => {
    process.env.APP_URL = "https://example.test/";
    const text = paymentClaimedMessage({ amount: 150000, reference: "ab12cd" });
    expect(text).toMatch(/150\D000\Dso.m/); // formatUZS uses non-breaking spaces
    expect(text).toContain("ab12cd");
    expect(text).toContain("https://example.test/admin/payments");
    expect(text).not.toMatch(/@|\+998/);
  });

  it("keeps a hostile order code to one short line", () => {
    const text = paymentClaimedMessage({ amount: 1000, reference: "x\nHttps://evil.test\u0000y".repeat(5) });
    expect(text.split("\n")).toHaveLength(3);
  });
});
