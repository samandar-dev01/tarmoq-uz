import { describe, expect, it } from "vitest";
import { menuMoveFor, menuNextIndex } from "@/lib/menuNav";

// How the arrow keys, Home and End move the focus in an open menu (src/components/ui/Menu.tsx).

describe("menuMoveFor", () => {
  it("knows the four movement keys and nothing else", () => {
    expect(menuMoveFor("ArrowDown")).toBe("next");
    expect(menuMoveFor("ArrowUp")).toBe("prev");
    expect(menuMoveFor("Home")).toBe("first");
    expect(menuMoveFor("End")).toBe("last");
    for (const key of ["Enter", " ", "Tab", "Escape", "a", "ArrowLeft", "PageDown", "toString", "constructor"]) expect(menuMoveFor(key)).toBeNull();
  });
});

describe("menuNextIndex", () => {
  it("steps down and up, and wraps round at both ends", () => {
    expect(menuNextIndex("next", 0, 3)).toBe(1);
    expect(menuNextIndex("next", 2, 3)).toBe(0);
    expect(menuNextIndex("prev", 2, 3)).toBe(1);
    expect(menuNextIndex("prev", 0, 3)).toBe(2);
  });

  it("jumps to the first and the last item from anywhere", () => {
    expect(menuNextIndex("first", 2, 3)).toBe(0);
    expect(menuNextIndex("last", 0, 3)).toBe(2);
  });

  it("starts from the top going down and from the bottom going up when no item has the focus yet", () => {
    expect(menuNextIndex("next", -1, 3)).toBe(0);
    expect(menuNextIndex("prev", -1, 3)).toBe(2);
  });

  it("stays on the one item of a one-item menu, and has nothing to focus in an empty one", () => {
    expect(menuNextIndex("next", 0, 1)).toBe(0);
    expect(menuNextIndex("prev", 0, 1)).toBe(0);
    for (const move of ["next", "prev", "first", "last"] as const) expect(menuNextIndex(move, -1, 0)).toBe(-1);
  });
});
