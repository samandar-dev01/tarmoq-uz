import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isCurrentPath } from "@/lib/currentPath";
import { formatUZS } from "@/lib/format";
import { formatPriceFrom } from "@/lib/publicFormat";
import { parseSearch } from "@/lib/providers";
import { providerHref, searchCategoryHref, searchPageHref } from "@/lib/searchLinks";

// A crawler carries no cookie, so on a Russian page every link to a public page has to say `/ru` itself. The helpers below
// are what the search page, the cards and the filter panel use; the last test checks that no public page writes such a link by hand.

describe("the address of a creator's page", () => {
  it("is /providers/<slug> in Uzbek and /ru/providers/<slug> in Russian", () => {
    expect(providerHref("uz", "jasur-karimov")).toBe("/providers/jasur-karimov");
    expect(providerHref("ru", "jasur-karimov")).toBe("/ru/providers/jasur-karimov");
  });
});

describe("the search page's own links", () => {
  const filters = parseSearch({ q: "toy", city: "Andijon", category: "photography", sort: "newest", page: "3" });

  it("paging keeps every filter, drops the old page number, and gets the language prefix", () => {
    expect(searchPageHref("uz", filters, 2)).toBe("/search?q=toy&city=Andijon&category=photography&sort=newest&page=2");
    expect(searchPageHref("ru", filters, 2)).toBe("/ru/search?q=toy&city=Andijon&category=photography&sort=newest&page=2");
    // The first page has no page parameter.
    expect(searchPageHref("ru", filters, 1)).toBe("/ru/search?q=toy&city=Andijon&category=photography&sort=newest");
    expect(searchPageHref("uz", parseSearch({}), 1)).toBe("/search?sort=rating");
    expect(searchPageHref("ru", parseSearch({}), 1)).toBe("/ru/search?sort=rating");
  });

  it("a category pill changes only the category, starts at page 1, and gets the language prefix", () => {
    expect(searchCategoryHref("uz", filters, "drone")).toBe("/search?q=toy&city=Andijon&sort=newest&category=drone");
    expect(searchCategoryHref("ru", filters, "drone")).toBe("/ru/search?q=toy&city=Andijon&sort=newest&category=drone");
    // "All categories": the other filters stay.
    expect(searchCategoryHref("ru", filters)).toBe("/ru/search?q=toy&city=Andijon&sort=newest");
    expect(searchCategoryHref("uz", parseSearch({ sort: "rating" }))).toBe("/search?sort=rating");
    expect(searchCategoryHref("ru", parseSearch({ sort: "rating" }), "photography")).toBe("/ru/search?sort=rating&category=photography");
  });
});

describe("the price that starts somewhere", () => {
  it("is «450 000 soʻmdan» in Uzbek and «от 450 000 сум» in Russian", () => {
    expect(formatPriceFrom(450_000)).toBe(`${formatUZS(450_000)}dan`); // the ending is glued on, as the old markup did
    expect(formatPriceFrom(450_000, "ru")).toBe(`от ${formatUZS(450_000, "ru")}`);
    // Whatever kind of space the money format uses, to a reader the text is this:
    const plain = (text: string) => text.replace(/\s/g, " ");
    expect(plain(formatPriceFrom(450_000, "uz"))).toBe("450 000 soʻmdan");
    expect(plain(formatPriceFrom(450_000, "ru"))).toBe("от 450 000 сум");
    expect(plain(formatPriceFrom(1_200_000, "ru"))).toBe("от 1 200 000 сум");
  });
});

describe("no public page writes a link to a public page by hand", () => {
  const ROOT = join(__dirname, "..", "..");
  const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
  const walk = (dir: string): string[] => readdirSync(join(ROOT, dir)).flatMap((n) => (statSync(join(ROOT, dir, n)).isDirectory() ? walk(join(dir, n)) : /\.tsx?$/.test(n) ? [join(dir, n)] : []));
  const FILES = ["src/app/page.tsx", "src/app/not-found.tsx", "src/app/error.tsx", "src/components/FilterPanel.tsx", "src/components/ProviderCard.tsx", ...walk("src/app/search"), ...walk("src/app/providers")];

  // A bare "/", "/search..." or "/providers/..." as a link target or a form action. Private targets ("/login", "/register", "/orders", "/messages", "/dashboard") are fine.
  const HAND_WRITTEN = [/href="\/"/, /href="\/search/, /href=\{`\/search/, /href=\{`\/providers/, /href="\/providers/, /action="\/search/, /redirect\("\/(search|providers)?"?\)/];

  it("the pages and components of this area use localHref (or the helpers built on it) for every public link", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(8);
    for (const file of FILES) {
      const code = read(file).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
      for (const re of HAND_WRITTEN) expect(code, `${file}: ${re}`).not.toMatch(re);
    }
  });

  it("and they really do call it", () => {
    expect(read("src/app/page.tsx")).toContain('localHref(locale, "/search")');
    expect(read("src/components/FilterPanel.tsx")).toContain('localHref(locale, "/search")');
    expect(read("src/components/ProviderCard.tsx")).toContain("providerHref(locale, p.slug)");
    expect(read("src/app/not-found.tsx")).toContain('localHref(locale, "/")');
    expect(read("src/app/error.tsx")).toContain('localHref(locale, "/")');
    expect(read("src/app/search/page.tsx")).toContain("searchPageHref(locale");
    expect(read("src/app/search/page.tsx")).toContain("searchCategoryHref(locale");
  });
});

describe("which header link is the current page, on a Russian address", () => {
  it("does not care about the /ru prefix, so the server (rewritten path) and the browser (address bar) agree", () => {
    // The server renders /ru/search as the page /search; the browser reads /ru/search. Both must mark the same link.
    for (const pathname of ["/search", "/ru/search"]) {
      expect(isCurrentPath(pathname, "/ru/search"), pathname).toBe(true);
      expect(isCurrentPath(pathname, "/search"), pathname).toBe(true);
      expect(isCurrentPath(pathname, "/ru/dashboard/client"), pathname).toBe(false);
    }
    expect(isCurrentPath("/ru/providers/jasur-karimov", "/ru/search")).toBe(false);
    expect(isCurrentPath("/ru", "/ru", true)).toBe(true);
    expect(isCurrentPath("/ru", "/messages")).toBe(false);
    expect(isCurrentPath("/rustam", "/ru")).toBe(false); // only the real prefix is removed
  });
});
