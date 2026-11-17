import { describe, expect, it } from "vitest";
import { hasUnreadFromOthers } from "@/lib/messaging";

const me = "u-me";
const other = "u-other";
const read = new Date("2026-11-17T10:00:00Z");

describe("hasUnreadFromOthers (decides whether a chat poll has to write)", () => {
  it("is false for an empty poll, the usual case: no UPDATE runs", () => {
    expect(hasUnreadFromOthers([], me)).toBe(false);
  });

  it("is false when everything new is my own message", () => {
    expect(hasUnreadFromOthers([{ senderId: me, readAt: null }], me)).toBe(false);
  });

  it("is false when the other person's messages are already read", () => {
    expect(hasUnreadFromOthers([{ senderId: other, readAt: read }], me)).toBe(false);
  });

  it("is true as soon as one message from the other person is unread", () => {
    expect(
      hasUnreadFromOthers(
        [
          { senderId: me, readAt: null },
          { senderId: other, readAt: read },
          { senderId: other, readAt: null },
        ],
        me,
      ),
    ).toBe(true);
  });
});
