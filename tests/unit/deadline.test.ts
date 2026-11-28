import { describe, expect, it } from "vitest";
import { dueDate, remaining } from "@/lib/deadline";

describe("delivery deadline", () => {
  const start = new Date("2026-11-28T10:00:00Z");

  it("is a number of days after the payment", () => {
    expect(dueDate(start, 2).toISOString()).toBe("2026-11-30T10:00:00.000Z");
  });

  it("counts down, then counts how late it is", () => {
    expect(remaining(dueDate(start, 2), new Date("2026-11-29T08:30:00Z"))).toEqual({ late: false, days: 1, hours: 1, minutes: 30 });
    expect(remaining(start, new Date("2026-11-30T12:05:00Z"))).toEqual({ late: true, days: 2, hours: 2, minutes: 5 });
  });
});
