import { describe, expect, it } from "vitest";
import { catalogSuggestions, normalize } from "@/lib/suggestMatch";

describe("search suggestions", () => {
  it("compares without case or apostrophes", () => {
    expect(normalize("  Toʻy   VIDEOSI ")).toBe("toy videosi");
    expect(normalize("to'y")).toBe("toy");
  });

  it("offers directions and subdirections that hold the text, in the reader's language", () => {
    const uz = catalogSuggestions("uz", "toy");
    expect(uz.length).toBeGreaterThan(0);
    expect(uz.every((s) => s.kind === "category" && s.href.startsWith("/search?"))).toBe(true);
    expect(uz.map((s) => s.label)).toContain("Toʻy va tadbirlar");
    expect(catalogSuggestions("ru", "фото")[0]).toEqual({ label: "Фотография", kind: "category", href: "/search?category=photography" });
  });

  it("offers nothing for one letter or no match, and no more than asked", () => {
    expect(catalogSuggestions("uz", "t")).toEqual([]);
    expect(catalogSuggestions("uz", "zzzz")).toEqual([]);
    expect(catalogSuggestions("uz", "o", 2)).toEqual([]);
    expect(catalogSuggestions("uz", "ta", 2).length).toBeLessThanOrEqual(2);
  });
});
