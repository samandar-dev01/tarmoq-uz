// A creator's own numbers for their cabinet. Pure.
import { toTashkent } from "./format";

export type MonthTotal = { key: string; label: string; total: number };

/** The last `months` calendar months in Tashkent time, oldest first, each with the sum of its amounts (0 when none). */
export function monthlyTotals(entries: readonly { amount: number; createdAt: Date }[], now = new Date(), months = 6): MonthTotal[] {
  const keyOf = (d: Date) => {
    const t = toTashkent(d);
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const here = toTashkent(now);
  const out = Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(here.getUTCFullYear(), here.getUTCMonth() - (months - 1 - i), 1));
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    return { key: `${year}-${month}`, label: `${month}.${year}`, total: 0 };
  });
  for (const e of entries) {
    const slot = out.find((m) => m.key === keyOf(e.createdAt));
    if (slot) slot.total += e.amount;
  }
  return out;
}

/** Completed orders as a share of the finished ones (completed or cancelled), in whole percent; null before the first. */
export const completionRate = (completed: number, cancelled: number): number | null =>
  completed + cancelled === 0 ? null : Math.round((completed * 100) / (completed + cancelled));
