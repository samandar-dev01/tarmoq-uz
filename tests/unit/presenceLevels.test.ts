import { describe, expect, it } from "vitest";
import { isOnline, ONLINE_MS, touchDue, usualResponseHours } from "@/lib/presence";
import { sellerLevel } from "@/lib/levels";
import { isTyping, noteTyping, stopTyping } from "@/lib/typing";

const now = Date.parse("2026-11-28T10:00:00Z");
const ago = (ms: number) => new Date(now - ms);

describe("presence", () => {
  it("is online only when seen in the last minutes", () => {
    expect(isOnline(ago(1000), now)).toBe(true);
    expect(isOnline(ago(ONLINE_MS), now)).toBe(false);
    expect(isOnline(null, now)).toBe(false);
    expect(isOnline("nonsense", now)).toBe(false);
  });

  it("writes the last visit at most once a minute", () => {
    expect(touchDue(ago(10_000), now)).toBe(false);
    expect(touchDue(ago(61_000), now)).toBe(true);
    expect(touchDue(null, now)).toBe(true);
  });

  it("finds the usual answering time from at least two answers", () => {
    const talk = (hours: number) => [{ senderId: "c", createdAt: ago(100 * 3600_000) }, { senderId: "me", createdAt: ago((100 - hours) * 3600_000) }];
    expect(usualResponseHours([talk(1)], "me")).toBeNull();
    expect(usualResponseHours([talk(0.2), talk(0.5)], "me")).toBe(1);
    expect(usualResponseHours([talk(2), talk(5), talk(30)], "me")).toBe(5);
    expect(usualResponseHours([[{ senderId: "me", createdAt: ago(0) }]], "me")).toBeNull();
  });

  it("keeps typing for a few seconds only", () => {
    noteTyping("k", "u", now);
    expect(isTyping("k", "u", now + 5000)).toBe(true);
    expect(isTyping("k", "u", now + 7000)).toBe(false);
    noteTyping("k", "u", now);
    stopTyping("k", "u");
    expect(isTyping("k", "u", now)).toBe(false);
  });
});

describe("seller levels", () => {
  it("climbs with completed orders, reviews and rating together", () => {
    expect(sellerLevel({ completedCount: 0, ratingAvg: 0, ratingCount: 0 })).toBe(0);
    expect(sellerLevel({ completedCount: 3, ratingAvg: 4.5, ratingCount: 1 })).toBe(1);
    expect(sellerLevel({ completedCount: 30, ratingAvg: 4.4, ratingCount: 30 })).toBe(0);
    expect(sellerLevel({ completedCount: 10, ratingAvg: 4.7, ratingCount: 5 })).toBe(2);
    expect(sellerLevel({ completedCount: 20, ratingAvg: 4.8, ratingCount: 10 })).toBe(3);
  });
});
