import { describe, expect, it } from "vitest";
import { addSeen, parseSeen, seenCookie, SEEN_LIMIT } from "@/lib/recentPure";

describe("recently viewed creators", () => {
  it("reads only well-formed slugs, each once", () => {
    expect(parseSeen("a-1.b.a-1.<script>.UPPER..c")).toEqual(["a-1", "b", "c"]);
    expect(parseSeen(undefined)).toEqual([]);
    expect(parseSeen("")).toEqual([]);
  });

  it("puts the latest visit first and keeps a short list", () => {
    expect(addSeen(["a", "b"], "b")).toEqual(["b", "a"]);
    const many = Array.from({ length: 20 }, (_, i) => `s${i}`);
    expect(addSeen(many, "new")).toHaveLength(SEEN_LIMIT);
    expect(addSeen(many, "new")[0]).toBe("new");
    expect(addSeen(["a"], "bad slug!")).toEqual(["a"]);
  });

  it("writes a month-long same-site cookie that reads back", () => {
    const text = seenCookie(["a", "b-2"]);
    expect(text).toBe("seen=a.b-2; Path=/; Max-Age=2592000; SameSite=Lax");
    expect(parseSeen(text.split(";")[0]!.split("=")[1])).toEqual(["a", "b-2"]);
  });
});
