/**
 * THE platform fee. This file is the only place the number lives: checkout, the provider's payout
 * preview, the order page, the agreement text and the ledger all call it. Never write a fee inline.
 *
 * Rule (decided 2026-11-12): 10% of the order total, never less than 15 000 soʻm, taken out of the
 * ijodkor's payout. The client pays exactly the agreed price.
 *
 * Money is whole soʻm in integers. Nothing here uses fractions: the percentage is applied with integer
 * division, rounding the fee DOWN, so fee + payout always equals the total exactly.
 */
export const PLATFORM_FEE = {
  percent: 10,
  minimumUZS: 15_000,
} as const;

export type FeeBreakdown = {
  /** What the client pays: the agreed price. */
  total: number;
  /** What the platform keeps. */
  fee: number;
  /** What the ijodkor receives: total - fee. */
  payout: number;
  /** True when the minimum applied instead of the percentage. */
  minimumApplied: boolean;
};

/** Splits an order total (whole soʻm) into the platform fee and the ijodkor's payout. */
export function platformFee(totalUZS: number): FeeBreakdown {
  if (!Number.isSafeInteger(totalUZS) || totalUZS < 0) {
    throw new RangeError(`Order total must be a non-negative whole number of soʻm, got ${totalUZS}`);
  }
  const scaled = totalUZS * PLATFORM_FEE.percent;
  const byPercent = (scaled - (scaled % 100)) / 100; // integer floor, no floating point
  const wanted = byPercent < PLATFORM_FEE.minimumUZS ? PLATFORM_FEE.minimumUZS : byPercent;
  // The fee can never exceed what was paid (an order smaller than the minimum fee pays out nothing).
  const fee = wanted > totalUZS ? totalUZS : wanted;
  return { total: totalUZS, fee, payout: totalUZS - fee, minimumApplied: fee !== byPercent };
}

/** Below this order total the minimum fee applies instead of the percentage (150 000 soʻm today). */
export const FEE_MINIMUM_APPLIES_BELOW = Math.ceil((PLATFORM_FEE.minimumUZS * 100) / PLATFORM_FEE.percent);
