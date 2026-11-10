import { describe, it, expect } from "vitest";
import { parseSearch } from "@/lib/providers";

describe("parseSearch", () => {
  it("uses defaults when nothing is given", () => {
    const f = parseSearch({});
    expect(f.sort).toBe("rating");
    expect(f.page).toBe(1);
    expect(f.city).toBeUndefined();
  });

  it("treats empty form fields as not set (an empty price must not become 0)", () => {
    const f = parseSearch({ q: "", city: "", minPrice: "", maxPrice: "" });
    expect(f.minPrice).toBeUndefined();
    expect(f.maxPrice).toBeUndefined();
  });

  it("ignores invalid values instead of failing", () => {
    const f = parseSearch({ city: "Atlantis", minPrice: "abc", sort: "hax", page: "-3" });
    expect(f.city).toBeUndefined();
    expect(f.minPrice).toBeUndefined();
    expect(f.sort).toBe("rating");
    expect(f.page).toBe(1);
  });

  it("swaps min and max when they are reversed", () => {
    const f = parseSearch({ minPrice: "500000", maxPrice: "100000" });
    expect(f.minPrice).toBe(100000);
    expect(f.maxPrice).toBe(500000);
  });

  it("reads the first value of repeated params", () => {
    expect(parseSearch({ city: ["Andijon", "Toshkent"] }).city).toBe("Andijon");
  });
});
