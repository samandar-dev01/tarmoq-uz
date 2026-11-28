import { tk } from "../i18n/dictionary";

// A creator's level, earned from completed orders and reviews. Pure.
export type SellerLevel = 0 | 1 | 2 | 3;

/** What each level needs at least: [completed orders, reviews, average rating]. The search filter uses the same numbers. */
export const LEVEL_MINIMUM: Record<Exclude<SellerLevel, 0>, readonly [number, number, number]> = { 1: [3, 1, 4.5], 2: [10, 5, 4.7], 3: [20, 10, 4.8] };

export function sellerLevel(p: { completedCount: number; ratingAvg: number; ratingCount: number }): SellerLevel {
  for (const level of [3, 2, 1] as const) {
    const [completed, reviews, rating] = LEVEL_MINIMUM[level];
    if (p.completedCount >= completed && p.ratingCount >= reviews && p.ratingAvg >= rating) return level;
  }
  return 0;
}

/** Level 0 has no label of its own (a creator with no reviews is shown as new, as before). */
export const LEVEL_LABEL: Record<Exclude<SellerLevel, 0>, string> = { 1: tk("1-daraja"), 2: tk("2-daraja"), 3: tk("Eng yaxshi ijodkor") };
