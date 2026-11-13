import { describe, it, expect } from "vitest";
import { evaluateTestCard } from "@/lib/payments/pure";

const NOW = new Date("2026-06-15T12:00:00Z");
const card = (number: string, over: Partial<{ expMonth: number; expYear: number; cvc: string }> = {}) =>
  evaluateTestCard({ number, expMonth: 12, expYear: 2034, cvc: "123", ...over }, NOW);

describe("sandbox cards", () => {
  it("accepts the success test card (with or without spaces)", () => {
    for (const n of ["4242424242424242", "4242 4242 4242 4242", "4242-4242-4242-4242"]) {
      const r = card(n);
      expect(r.outcome).toBe("success");
      if (r.outcome === "success") {
        expect(r.last4).toBe("4242");
        expect(r.brand).toBe("visa");
      }
    }
  });

  it("declines the decline test cards with the right code", () => {
    const a = card("4000 0000 0000 0002");
    const b = card("4000 0000 0000 9995");
    expect(a.outcome).toBe("declined");
    expect(b.outcome).toBe("declined");
    if (a.outcome === "declined") expect(a.failureCode).toBe("card_declined");
    if (b.outcome === "declined") expect(b.failureCode).toBe("insufficient_funds");
  });

  it("never succeeds for an unknown card number", () => {
    for (const n of ["1111111111111111", "4242424242424241", "4111111111111111", "5555555555554443"]) {
      expect(card(n).outcome).toBe("invalid");
    }
  });

  it("rejects malformed input", () => {
    expect(card("abcd").outcome).toBe("invalid");
    expect(card("4242424242424242", { expMonth: 13 }).outcome).toBe("invalid");
    expect(card("4242424242424242", { expMonth: 0 }).outcome).toBe("invalid");
    expect(card("4242424242424242", { cvc: "12" }).outcome).toBe("invalid");
    expect(card("4242424242424242", { cvc: "abc" }).outcome).toBe("invalid");
  });

  it("rejects expired cards but accepts the current month and two-digit years", () => {
    expect(card("4242424242424242", { expMonth: 5, expYear: 2026 }).outcome).toBe("invalid");
    expect(card("4242424242424242", { expMonth: 6, expYear: 2026 }).outcome).toBe("success");
    expect(card("4242424242424242", { expMonth: 12, expYear: 34 }).outcome).toBe("success");
  });
});
