import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, otherTheme, parseTheme, THEME_BROWSER_COLOR, THEME_COOKIE, themeCookie } from "@/lib/themePure";

describe("theme cookie", () => {
  it("accepts only the exact words light and dark", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("treats a missing or unknown value as light, the default for a first visit", () => {
    expect(DEFAULT_THEME).toBe("light");
    for (const bad of [undefined, null, "", " ", "Light", "LIGHT", "Dark", "light ", " dark", "auto", "system", "1", "true", "0", "light;dark", "<script>", "ligh"]) {
      expect(parseTheme(bad as string | null | undefined)).toBe("light");
    }
  });

  it("flips between the two schemes", () => {
    expect(otherTheme("dark")).toBe("light");
    expect(otherTheme("light")).toBe("dark");
  });

  it("writes a readable, year-long, same-site cookie for the whole site, with no secret in it", () => {
    expect(THEME_COOKIE).toBe("theme");
    for (const theme of ["light", "dark"] as const) {
      const text = themeCookie(theme);
      expect(text.startsWith(`theme=${theme};`)).toBe(true);
      expect(text).toContain("Path=/");
      expect(text).toContain("Max-Age=31536000");
      expect(text).toContain("SameSite=Lax");
      expect(text.toLowerCase()).not.toContain("httponly"); // the toggle writes it in the browser
      expect(parseTheme(text.split(";")[0]!.split("=")[1])).toBe(theme); // what is written reads back
    }
  });

  it("has a browser bar colour for each scheme, as a hex colour", () => {
    expect(THEME_BROWSER_COLOR.dark).toMatch(/^#[0-9A-F]{6}$/);
    expect(THEME_BROWSER_COLOR.light).toMatch(/^#[0-9A-F]{6}$/);
    expect(THEME_BROWSER_COLOR.dark).not.toBe(THEME_BROWSER_COLOR.light);
  });
});
