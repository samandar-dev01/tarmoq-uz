import { beforeEach, describe, expect, it, vi } from "vitest";

const { count, findMany } = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { service: { count, findMany } } }));

import { translate } from "@/i18n/dictionary";
import { CATALOG } from "@/lib/catalog";
import { meaningSearches, parseSearch, searchServices } from "@/lib/providers";
import { SEARCH_EXAMPLES, spellings, understand } from "@/lib/searchWords";

const meaning = (q: string) => {
  const m = understand(q);
  return { concepts: m.concepts.map((c) => c.name).sort(), words: m.words, city: m.city };
};
const asks = (...concepts: string[]) => ({ concepts: concepts.sort(), words: [], city: null });

describe("what a typed sentence asks for", () => {
  const wanted = [["photo", "wedding"], ["business", "video"], ["reels"], ["drone"], ["photo", "product"]];

  it("understands every example the home page shows, in both languages, with no word left over", () => {
    expect(SEARCH_EXAMPLES).toHaveLength(wanted.length);
    for (const [i, example] of SEARCH_EXAMPLES.entries()) {
      for (const locale of ["uz", "ru"] as const) {
        const shown = translate(locale, example);
        expect(meaning(shown), shown).toEqual(asks(...wanted[i]!));
      }
    }
  });

  it("reads any apostrophe, or none", () => {
    for (const q of ["toʻy", "to'y", "to‘y", "to’y", "toy", "TOʻYGA"]) expect(meaning(q), q).toEqual(asks("wedding"));
    expect(spellings("toʻy")).toEqual(expect.arrayContaining(["toʻy", "to'y", "to‘y", "to’y", "toy"]));
    expect(spellings("reel")).toEqual(["reel"]);
  });

  it("hears the longest beginning: editing in «videomontaj», a business owner in «tadbirkor»", () => {
    expect(meaning("videomontaj")).toEqual(asks("editing"));
    expect(meaning("tadbirkorlar")).toEqual(asks("business"));
    expect(meaning("tadbirlar")).toEqual(asks("events"));
  });

  it("takes a city named in the sentence, and keeps words it does not know", () => {
    expect(meaning("Toshkentda toʻy videosi kerak")).toEqual({ concepts: ["video", "wedding"], words: [], city: "Toshkent" });
    expect(meaning("Fargʻonada fotograf")).toEqual({ concepts: ["photo"], words: [], city: "Fargʻona" });
    expect(meaning("gimbal bilan Jasur")).toEqual({ concepts: [], words: ["gimbal", "jasur"], city: null });
  });

  it("asks for nothing when there are only filler words", () => {
    expect(meaning("menga yaxshi ijodkor kerak")).toEqual(asks());
    expect(meaning("… ! ??")).toEqual(asks());
  });

  it("every subdirection a concept names exists in the catalog", () => {
    const subs = new Set(CATALOG.flatMap((c) => c.subcategories.map((s) => s.slug)));
    const slugs = new Set(CATALOG.map((c) => c.slug));
    for (const c of understand("toʻy foto video mobil montaj dron reel kafe mahsulot tadbir portret mulk youtube subtitr sayohat").concepts) {
      for (const s of c.subs ?? []) expect(subs, `${c.name}: ${s}`).toContain(s);
      for (const s of c.categories ?? []) expect(slugs, `${c.name}: ${s}`).toContain(s);
    }
  });
});

describe("the searches tried when the phrase finds nothing", () => {
  it("first everything asked for, then any of it, marked as close", () => {
    const [all, any, ...rest] = meaningSearches(parseSearch({ q: "Toʻyimiz uchun fotograf kerak" }));
    expect(rest).toEqual([]);
    expect(all!.close).toBe(false);
    expect(all!.where.AND).toHaveLength(2);
    expect(any!.close).toBe(true);
    expect(any!.where.AND).toEqual([{ OR: all!.where.AND }]);
  });

  it("has nothing looser to try for a single thing, and nothing at all without words", () => {
    expect(meaningSearches(parseSearch({ q: "dron orqali" })).map((s) => s.close)).toEqual([false]);
    expect(meaningSearches(parseSearch({ q: "kerak" }))).toEqual([]);
    expect(meaningSearches(parseSearch({}))).toEqual([]);
  });

  it("keeps the visitor's filters; a city in the sentence counts only when none was chosen", () => {
    const [chosen] = meaningSearches(parseSearch({ q: "Samarqandda toʻy", city: "Andijon", maxPrice: "500000" }));
    expect(chosen!.where).toMatchObject({ isActive: true, price: { lte: 500000 }, profile: { status: "APPROVED", city: "Andijon" } });
    const [named] = meaningSearches(parseSearch({ q: "Samarqandda toʻy" }));
    expect(named!.where.profile).toMatchObject({ city: "Samarqand" });
    expect(named!.where.OR).toBeUndefined(); // the phrase itself is no longer required
  });
});

describe("searchServices", () => {
  beforeEach(() => {
    count.mockReset();
    findMany.mockReset().mockResolvedValue([]);
  });

  it("answers a phrase that is found exactly as before, with one search", async () => {
    count.mockResolvedValue(3);
    const result = await searchServices(parseSearch({ q: "toʻy fotograf" }));
    expect(result).toMatchObject({ total: 3, close: false });
    expect(count).toHaveBeenCalledTimes(1);
  });

  it("goes on to the meaning, and says when the results are only close", async () => {
    count.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    expect(await searchServices(parseSearch({ q: "toʻy fotograf" }))).toMatchObject({ total: 2, close: true });
    expect(count).toHaveBeenCalledTimes(3);
  });

  it("does not call an empty answer close", async () => {
    count.mockResolvedValue(0);
    expect(await searchServices(parseSearch({ q: "toʻy fotograf" }))).toMatchObject({ total: 0, pages: 1, close: false });
  });
});
