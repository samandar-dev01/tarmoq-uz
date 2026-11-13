import { describe, it, expect } from "vitest";
import { FEE_MINIMUM_APPLIES_BELOW, PLATFORM_FEE, platformFee } from "@/lib/fees";

describe("platform fee (10%, minimum 15 000 soʻm, deducted from the payout)", () => {
  it("is the agreed rule", () => {
    expect(PLATFORM_FEE).toEqual({ percent: 10, minimumUZS: 15_000 });
    expect(FEE_MINIMUM_APPLIES_BELOW).toBe(150_000);
  });

  it("takes 10% of ordinary orders", () => {
    expect(platformFee(300_000)).toEqual({ total: 300_000, fee: 30_000, payout: 270_000, minimumApplied: false });
    expect(platformFee(1_500_000)).toMatchObject({ fee: 150_000, payout: 1_350_000 });
    expect(platformFee(50_000_000)).toMatchObject({ fee: 5_000_000, payout: 45_000_000 });
  });

  it("applies the 15 000 minimum to small orders, and exactly meets the percentage at 150 000", () => {
    expect(platformFee(100_000)).toEqual({ total: 100_000, fee: 15_000, payout: 85_000, minimumApplied: true });
    expect(platformFee(149_999)).toMatchObject({ fee: 15_000, minimumApplied: true });
    expect(platformFee(150_000)).toEqual({ total: 150_000, fee: 15_000, payout: 135_000, minimumApplied: false });
    expect(platformFee(150_010)).toMatchObject({ fee: 15_001, minimumApplied: false });
    expect(platformFee(20_000)).toMatchObject({ fee: 15_000, payout: 5_000 }); // the smallest price a package can have
  });

  it("never takes more than was paid", () => {
    expect(platformFee(10_000)).toEqual({ total: 10_000, fee: 10_000, payout: 0, minimumApplied: true });
    expect(platformFee(0)).toEqual({ total: 0, fee: 0, payout: 0, minimumApplied: false });
  });

  it("rounds the fee down to a whole soʻm", () => {
    expect(platformFee(333_333)).toMatchObject({ fee: 33_333, payout: 300_000 });
    expect(platformFee(999_999)).toMatchObject({ fee: 99_999, payout: 900_000 });
  });

  it("always returns integers that add up to the total", () => {
    for (let total = 0; total <= 2_000_000; total += 7_919) {
      const { fee, payout } = platformFee(total);
      expect(Number.isInteger(fee) && Number.isInteger(payout)).toBe(true);
      expect(fee + payout).toBe(total);
      expect(fee).toBeGreaterThanOrEqual(0);
      expect(payout).toBeGreaterThanOrEqual(0);
    }
  });

  it("has no floating-point drift on amounts where a float multiply would", () => {
    // 0.1 * 3 !== 0.3 in floating point; integer math must not care.
    expect(platformFee(4_350_000).fee).toBe(435_000);
    expect(platformFee(9_007_199_254_740).fee).toBe(900_719_925_474);
  });

  it("refuses anything that is not a whole, non-negative amount", () => {
    for (const bad of [1.5, -1, NaN, Infinity, 2 ** 60]) expect(() => platformFee(bad)).toThrow(RangeError);
  });
});
