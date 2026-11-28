import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { THEME_BROWSER_COLOR } from "@/lib/themePure";

// Reads the real theme (src/app/globals.css) and measures the pairings the site actually uses, in both colour schemes.
// The standard is WCAG 2.2 AA, chosen by the owner's brief (not a rule of the project's own): 4.5:1 for text, 3:1 for
// icons, focus rings and other non-text parts that carry meaning. Borders only have to be seen, so they have their own bar.

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const css = read("src/app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");

type Declarations = Record<string, string>;
function block(selector: RegExp): Declarations {
  const body = selector.exec(css)?.[1];
  if (body === undefined) throw new Error(`No block for ${selector} in globals.css`);
  const out: Declarations = {};
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}
const DARK = block(/:root\s*\{([^}]*)\}/);
const LIGHT = block(/html\[data-theme="light"\]\s*\{([^}]*)\}/);

// What does not change with the scheme (the light block must not repeat these).
const FIXED = ["c-cobalt", "c-saffron", "c-pomegranate", "c-turquoise", "c-lilac", "c-night", "c-on-accent", "c-media", "c-cover-ink", "c-cover-night"];

type Scheme = "dark" | "light";
const SCHEMES: Scheme[] = ["dark", "light"];
const declared = (scheme: Scheme, name: string): string => {
  const v = (scheme === "light" ? LIGHT[name] : undefined) ?? DARK[name];
  if (v === undefined) throw new Error(`--${name} is not defined`);
  return v;
};

type RGB = [number, number, number];
const rgb = (scheme: Scheme, name: string): RGB => {
  const parts = declared(scheme, `c-${name}`).split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) throw new Error(`--c-${name} is not an RGB triplet`);
  return parts as RGB;
};
const num = (scheme: Scheme, name: string) => Number(declared(scheme, name));

const linear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: RGB) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
/** `fg` at `alpha` laid over `bg`. */
const over = (fg: RGB, bg: RGB, alpha: number): RGB => fg.map((v, i) => v * alpha + bg[i]! * (1 - alpha)) as RGB;
const hex = ([r, g, b]: RGB) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`.toUpperCase();

const GROUNDS = ["paper", "surface", "paper-deep", "warm"];
const TINTS = ["cobalt-tint", "saffron-tint", "pomegranate-tint", "turquoise-tint", "lilac-tint"];

type Pair = { label: string; fg: RGB; bg: RGB; min: number };
function pairs(s: Scheme): Pair[] {
  const c = (name: string) => rgb(s, name);
  const out: Pair[] = [];
  const text = (label: string, fg: RGB, bg: RGB, min = 4.5) => out.push({ label, fg, bg, min });

  // Body text. Cards of every tone and every tag carry ink and ink-soft; ink-mute is real text too (dates, hints, the
  // disabled pager, the cancelled badge), not only placeholders.
  for (const g of [...GROUNDS, ...TINTS]) {
    text(`ink on ${g}`, c("ink"), c(g));
    text(`ink-soft on ${g}`, c("ink-soft"), c(g));
  }
  for (const g of [...GROUNDS, "cobalt-tint"]) text(`ink-mute on ${g}`, c("ink-mute"), c(g));
  text("ink-mute on paper-deep at 60% over surface (profile wizard step)", c("ink-mute"), over(c("paper-deep"), c("surface"), 0.6));

  // Text on a bright fill.
  text("on-accent on cobalt (primary button, chat bubble, selected role card, step 1)", c("on-accent"), c("cobalt"));
  text("on-accent on pomegranate (danger button, unread badge, step 4)", c("on-accent"), c("pomegranate"));
  text("night on saffron (accent button, chip on, Yangi, step 2)", c("night"), c("saffron"));
  text("night on turquoise (step 3)", c("night"), c("turquoise"));

  // An accent used as text or as an icon, on its ground and on its own tint.
  for (const g of [...GROUNDS, "cobalt-tint"]) text(`cobalt-dark on ${g}`, c("cobalt-dark"), c(g));
  for (const g of ["paper", "surface", "saffron-tint"]) text(`saffron-deep on ${g}`, c("saffron-deep"), c(g));
  text("saffron-deep on saffron at 15% over paper (the active nav link)", c("saffron-deep"), over(c("saffron"), c("paper"), 0.15));
  for (const g of [...GROUNDS, "pomegranate-tint"]) text(`pomegranate-deep on ${g}`, c("pomegranate-deep"), c(g));
  for (const g of ["paper", "surface", "turquoise-tint"]) text(`turquoise-deep on ${g}`, c("turquoise-deep"), c(g));

  // Parts that carry meaning without words need 3:1.
  for (const g of GROUNDS) text(`focus ring on ${g}`, c("focus"), c(g), 3);
  text("cobalt field border on focus, on surface", c("cobalt"), c("surface"), 3);
  for (const g of ["paper", "surface"]) text(`filled star on ${g}`, c("star"), c(g), 3);
  return out;
}

describe.each(SCHEMES)("%s scheme contrast", (scheme) => {
  for (const p of pairs(scheme)) {
    it(`${p.label} reaches ${p.min}:1`, () => {
      expect(contrast(p.fg, p.bg)).toBeGreaterThanOrEqual(p.min);
    });
  }

  it("keeps hairlines and control edges visible on every ground (at least 1.2:1 and 1.4:1)", () => {
    const line = rgb(scheme, "line");
    for (const g of GROUNDS) {
      const ground = rgb(scheme, g);
      expect(contrast(over(line, ground, num(scheme, "c-line-a")), ground), `hairline on ${g}`).toBeGreaterThanOrEqual(1.2);
      expect(contrast(over(line, ground, num(scheme, "c-line-strong-a")), ground), `control edge on ${g}`).toBeGreaterThanOrEqual(1.4);
    }
  });

  it("keeps the strong edge stronger than the hairline", () => {
    expect(num(scheme, "c-line-strong-a")).toBeGreaterThan(num(scheme, "c-line-a"));
  });

  it("orders its ground, card and hover so that a card still stands off the page and a hover is seen", () => {
    expect(contrast(rgb(scheme, "paper"), rgb(scheme, "paper-deep"))).toBeGreaterThan(1.05);
    expect(contrast(rgb(scheme, "surface"), rgb(scheme, "paper-deep"))).toBeGreaterThan(1.05);
  });
});

describe("the two schemes", () => {
  it("defines every token the light block overrides in the dark block too (no typos, no light-only name)", () => {
    for (const name of Object.keys(LIGHT)) expect(DARK, `--${name}`).toHaveProperty(name);
  });

  it("overrides every token that has to flip, and none that must stay the same", () => {
    for (const name of Object.keys(DARK)) {
      if (FIXED.includes(name)) expect(LIGHT, `--${name} is fixed`).not.toHaveProperty(name);
      else expect(LIGHT, `--${name} must have a light value`).toHaveProperty(name);
    }
  });

  it("really changes the colours that flip", () => {
    for (const name of ["ink", "paper", "surface", "paper-deep", "cobalt-tint", "saffron-tint", "pomegranate-tint", "turquoise-tint"]) {
      expect(declared("light", `c-${name}`), name).not.toBe(declared("dark", `c-${name}`));
    }
    expect(luminance(rgb("light", "paper"))).toBeGreaterThan(luminance(rgb("light", "ink")));
    expect(luminance(rgb("dark", "paper"))).toBeLessThan(luminance(rgb("dark", "ink")));
  });

  it("is white in light (the owner's choice): a white ground and cards, a neutral grey for hover", () => {
    expect(rgb("light", "paper")).toEqual([255, 255, 255]);
    expect(rgb("light", "surface")).toEqual([255, 255, 255]);
    const [r, g, b] = rgb("light", "paper-deep");
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(4);
  });

  it("tells the browser which scheme each block is", () => {
    expect(declared("dark", "c-ink")).toBeDefined();
    expect(/:root\s*\{\s*color-scheme:\s*dark;/.test(css)).toBe(true);
    expect(/html\[data-theme="light"\]\s*\{\s*color-scheme:\s*light;/.test(css)).toBe(true);
  });

  it("gives the browser bar the paper colour of each scheme", () => {
    expect(THEME_BROWSER_COLOR.dark).toBe(hex(rgb("dark", "paper")));
    expect(THEME_BROWSER_COLOR.light).toBe(hex(rgb("light", "paper")));
  });

  it("has a shadow set and a select chevron for each scheme, with a chevron stroke that reads on a field", () => {
    for (const s of SCHEMES) {
      for (const name of ["shadow-lift-sm", "shadow-lift", "shadow-lift-lg", "select-chevron"]) expect(declared(s, name)).toBeTruthy();
    }
    const stroke = (s: Scheme) => /stroke='%23([0-9A-Fa-f]{6})'/.exec(declared(s, "select-chevron"))?.[1];
    for (const s of SCHEMES) {
      const h = stroke(s);
      expect(h, `${s} chevron stroke`).toBeDefined();
      const color = [0, 2, 4].map((i) => parseInt(h!.slice(i, i + 2), 16)) as RGB;
      expect(contrast(color, rgb(s, "surface"))).toBeGreaterThanOrEqual(3);
    }
    // The light shadow is softer than the dark one.
    const alphas = (s: Scheme) => [...declared(s, "shadow-lift").matchAll(/\/\s*([0-9.]+)\)/g)].map((m) => Number(m[1]));
    expect(Math.max(...alphas("light"))).toBeLessThan(Math.max(...alphas("dark")));
  });
});

describe("theme names in use", () => {
  const files = (dir: string): string[] =>
    readdirSync(join(ROOT, dir)).flatMap((name) => {
      const path = `${dir}/${name}`;
      return statSync(join(ROOT, path)).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  const sources = files("src");

  it("only names variables and Tailwind colours that exist in the theme", () => {
    const names = new Set<string>();
    for (const path of [...sources, "tailwind.config.ts"]) {
      for (const m of read(path).matchAll(/--c-[a-z0-9-]+/g)) names.add(m[0].slice(2));
    }
    for (const m of read("tailwind.config.ts").matchAll(/\bc\("([a-z0-9-]+)"\)/g)) names.add(`c-${m[1]}`);
    expect(names.size).toBeGreaterThan(20);
    for (const name of names) expect(DARK, `--${name}`).toHaveProperty(name);
  });

  it("writes no white or black by hand in a component: colours come from the theme, so both schemes look right", () => {
    // The share-card picture and the manifest are rendered outside the page and cannot read the theme, and themePure.ts holds
    // the browser bar colours (checked against globals.css above); none of them is a component.
    const exempt = new Set(["src/app/opengraph-image.tsx", "src/app/manifest.ts", "src/lib/themePure.ts"]);
    const bad = /\b(?:text|bg|border|ring|from|via|to|fill|stroke|divide|outline|shadow)-(?:white|black)\b|#(?:fff|ffffff|000|000000)\b/i;
    const offenders = sources.filter((p) => !exempt.has(p)).filter((p) => bad.test(read(p)));
    expect(offenders).toEqual([]);
  });
});
