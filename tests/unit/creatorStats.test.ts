import { describe, expect, it } from "vitest";
import { completionRate, monthlyTotals } from "@/lib/creatorStats";

describe("creator statistics", () => {
  it("sums by Tashkent month, oldest first, with empty months kept", () => {
    const now = new Date("2026-02-10T12:00:00Z");
    const rows = monthlyTotals(
      [
        { amount: 100, createdAt: new Date("2026-02-01T00:00:00Z") },
        // 19:30 UTC on 31 January is already 1 February in Tashkent.
        { amount: 5, createdAt: new Date("2026-01-31T19:30:00Z") },
        { amount: 40, createdAt: new Date("2025-12-15T00:00:00Z") },
        { amount: 999, createdAt: new Date("2025-01-01T00:00:00Z") },
      ],
      now,
      3,
    );
    expect(rows).toEqual([
      { key: "2025-12", label: "12.2025", total: 40 },
      { key: "2026-01", label: "01.2026", total: 0 },
      { key: "2026-02", label: "02.2026", total: 105 },
    ]);
  });

  it("has no completion rate before anything finished", () => {
    expect(completionRate(0, 0)).toBeNull();
    expect(completionRate(3, 1)).toBe(75);
    expect(completionRate(0, 2)).toBe(0);
  });
});
