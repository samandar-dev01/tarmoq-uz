// The delivery countdown. Pure.
const DAY = 24 * 60 * 60 * 1000;

export const dueDate = (from: Date, days: number): Date => new Date(from.getTime() + days * DAY);

export type Remaining = { late: boolean; days: number; hours: number; minutes: number };

/** How long is left until `dueAt` (or has passed since), in whole days, hours and minutes. */
export function remaining(dueAt: Date, now = new Date()): Remaining {
  const gap = dueAt.getTime() - now.getTime();
  const left = Math.abs(gap);
  return { late: gap < 0, days: Math.floor(left / DAY), hours: Math.floor((left % DAY) / 3_600_000), minutes: Math.floor((left % 3_600_000) / 60_000) };
}
