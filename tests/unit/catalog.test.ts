import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG, catalogName, findCategory, findSubcategory } from "@/lib/catalog";

const seed = readFileSync(resolve(process.cwd(), "prisma/seed.ts"), "utf8");

describe("the catalog of directions", () => {
  it("holds exactly the categories the seed writes, with the same names", () => {
    const seeded = [...seed.matchAll(/\{ slug: "([a-z-]+)", name: "([^"]+)", nameRu: "([^"]+)" \}/g)].map((m) => ({ slug: m[1], name: m[2], nameRu: m[3] }));
    expect(seeded.length).toBeGreaterThan(0);
    expect(CATALOG.map(({ slug, name, nameRu }) => ({ slug, name, nameRu }))).toEqual(seeded);
  });

  it("gives every subcategory its own slug, an Uzbek and a Russian name", () => {
    const slugs = CATALOG.flatMap((c) => c.subcategories.map((s) => s.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of CATALOG) {
      expect(c.subcategories.length).toBeGreaterThan(0);
      for (const s of c.subcategories) {
        expect(s.slug).toMatch(/^[a-z]+(-[a-z]+)*$/);
        expect(s.name.length).toBeGreaterThan(0);
        expect(s.name).not.toMatch(/['’`]/); // Uzbek is written with U+02BB
        expect(s.nameRu).toMatch(/[А-Яа-яЁё]/);
      }
    }
  });

  it("finds a category and a subcategory by slug, and nothing for an unknown one", () => {
    expect(findCategory("drone")?.name).toBe("Dron bilan suratga olish");
    expect(findSubcategory("portrait")?.category.slug).toBe("photography");
    expect(findCategory("nope")).toBeUndefined();
    expect(findSubcategory(undefined)).toBeUndefined();
    expect(catalogName("ru", CATALOG[0]!)).toBe("Мобильная съёмка");
    expect(catalogName("uz", CATALOG[0]!)).toBe("Mobilografiya");
  });
});
