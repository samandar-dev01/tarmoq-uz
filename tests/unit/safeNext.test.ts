import { describe, it, expect } from "vitest";
import { safeNext } from "@/lib/safeNext";

describe("safeNext (P0-4: open redirect)", () => {
  it("keeps same-site relative paths", () => {
    for (const ok of ["/", "/orders/new?service=abc", "/providers/ali-vali", "/messages/new?to=u1#top"]) {
      expect(safeNext(ok)).toBe(ok);
    }
  });

  it("rejects anything that could leave the site", () => {
    for (const bad of [
      "//evil.com", "///evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "http://evil.com",
      "javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "evil.com", "orders/new", " /orders",
      "/\t/evil.com", "/\n/evil.com", "/a\\b", "", null, undefined,
    ]) {
      expect(safeNext(bad)).toBeNull();
    }
  });
});
