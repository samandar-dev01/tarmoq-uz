import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { RU_SERVER } from "@/i18n/rendered";
import { RU } from "@/i18n/ru";

// COMPLETENESS: every Uzbek sentence the code can show has a Russian entry.
//
// The test reads the source files (it does not run them) and collects every translation key it can see:
//   UI keys       t("...")  and  tk("...")                     -> must be in a page fragment (src/i18n/ru/*.ts except errors.ts)
//   server keys   new HttpError(<status>, "...")  msg("...")   -> must be in ru/errors.ts or a page fragment
//                 zod messages (.min(2, "..."), .email("..."), { message: "..." }, required_error: "...")
//                 and t( / tk( in files under src/app/api (text only the server says)
// It also fails on a server message built with a template literal (`...${x}...`), because nothing can translate that:
// write it with msg("... {x} ...", { x }) instead.
//
// SCOPE. Only the files listed in IN_SCOPE are checked, so that a branch is red only for its own work. A later language
// branch WIDENS the list with its folders (for example "src/app/orders/", "src/components/orders/", "src/app/api/orders/");
// the last one replaces the whole list with ["src/"]. An entry is a path from the repo root: a folder ends with "/".
// The second test below never fails: it prints how many keys are still untranslated outside the scope, per file, so
// each builder sees what is left for them.
//
// What it cannot see: a key that is not a plain double-quoted literal on one line (see the rules at the top of
// src/i18n/dictionary.ts), and Uzbek text that nobody wrapped in t( at all.

const IN_SCOPE = [
  "src/i18n/",
  "src/proxy.ts",
  // the shell
  "src/app/layout.tsx",
  "src/components/Header.tsx",
  "src/components/AccountMenu.tsx",
  "src/components/ui/",
  "src/lib/shellNav.ts",
  "src/lib/constants.ts",
  // signing in and up, no access
  "src/app/(auth)/",
  "src/app/forbidden/",
  "src/components/auth/",
  "src/app/api/auth/",
  // the server boundary
  "src/lib/http.ts",
  "src/lib/auth.ts",
  "src/lib/body.ts",
  "src/lib/validators.ts",
  "src/lib/rateLimit.ts",
];

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const STRING = '"((?:[^"\\\\\\n]|\\\\.)*)"';
const UI_KEY = new RegExp(`(?<![\\w.])(?:t|tk)\\(\\s*${STRING}`, "g");
const SERVER_KEYS = [
  new RegExp(`new HttpError\\(\\s*[\\w.]+\\s*,\\s*${STRING}`, "g"),
  new RegExp(`(?<![\\w.])msg\\(\\s*${STRING}`, "g"),
];
const ZOD_KEYS = [
  new RegExp(`\\.(?:min|max|length|email|url|regex|refine|superRefine|int|positive|nonnegative|nonempty|gte|lte|gt|lt|datetime|startsWith|endsWith|includes)\\([^"\\n]*?${STRING}\\s*\\)`, "g"),
  new RegExp(`(?:message|required_error|invalid_type_error)\\s*:\\s*${STRING}`, "g"),
];
const DYNAMIC = /new HttpError\(\s*[\w.]+\s*,\s*`[^`]*\$\{/g;

type Found = { file: string; ui: string[]; server: string[]; dynamic: number };

function scan(path: string): Found {
  const file = relative(ROOT, path).split("\\").join("/");
  // Whole-line comments hold examples, not text the site shows.
  const code = readFileSync(path, "utf8").split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join("\n");
  const all = (re: RegExp) => [...code.matchAll(re)].map((m) => JSON.parse(`"${m[1]}"`) as string);
  const marked = all(UI_KEY);
  const apiFile = file.startsWith("src/app/api/");
  const server = SERVER_KEYS.flatMap(all);
  if (/from "zod"/.test(code)) server.push(...ZOD_KEYS.flatMap(all));
  return { file, ui: apiFile ? [] : marked, server: apiFile ? [...server, ...marked] : server, dynamic: [...code.matchAll(DYNAMIC)].length };
}

const inScope = (file: string) => IN_SCOPE.some((entry) => (entry.endsWith("/") ? file.startsWith(entry) : file === entry));
// The Russian fragments themselves are data, not users of the dictionary.
const found = files(SRC).filter((p) => !p.includes(`${join("src", "i18n", "ru")}`)).map(scan);

function missing(f: Found): string[] {
  return [
    ...f.ui.filter((key) => !(key in RU)).map((key) => `${f.file}: "${key}" has no Russian entry in a page fragment (src/i18n/ru/*.ts, not errors.ts)`),
    ...f.server.filter((key) => !(key in RU_SERVER)).map((key) => `${f.file}: "${key}" has no Russian entry (src/i18n/ru/errors.ts)`),
    ...(f.dynamic ? [`${f.file}: ${f.dynamic} HttpError message(s) built with a template literal; use msg("... {x} ...", { x })`] : []),
  ];
}

describe("every Uzbek sentence has a Russian entry", () => {
  it("the scanner sees the keys it is meant to see", () => {
    const of = (file: string) => found.find((f) => f.file === file)!;
    expect(of("src/components/AccountMenu.tsx").ui).toEqual(["Hisob menyusi: {name}", "Chiqilmoqda…", "Chiqish"]);
    expect(of("src/lib/shellNav.ts").ui).toContain("Ijodkor boʻlib qoʻshilish");
    expect(of("src/lib/auth.ts").server).toEqual(["Davom etish uchun tizimga kiring.", "Buning uchun sizda ruxsat yoʻq."]);
    expect(of("src/lib/validators.ts").server).toEqual([
      "Ism-familiyangizni kiriting", "Email manzilini toʻgʻri kiriting", "Parol kamida 8 ta belgidan iborat boʻlsin",
      "Telefon raqamini toʻgʻri kiriting", "Email manzilini toʻgʻri kiriting", "Parolni kiriting",
    ]);
    expect(of("src/app/api/auth/login/route.ts").server).toContain("Email yoki parol notoʻgʻri.");
    expect(of("src/app/api/profile/route.ts").dynamic).toBe(1);
    expect(found.filter((f) => inScope(f.file)).reduce((n, f) => n + f.ui.length + f.server.length, 0)).toBeGreaterThan(80);
  });

  it("in the files that are in scope for this branch", () => {
    expect(found.filter((f) => inScope(f.file)).flatMap(missing)).toEqual([]);
  });

  it("reports what is left outside the scope (never fails)", () => {
    const rest = found.filter((f) => !inScope(f.file)).map((f) => ({ file: f.file, n: missing(f).length })).filter((r) => r.n > 0);
    if (rest.length) {
      console.info(`i18n: ${rest.reduce((n, r) => n + r.n, 0)} key(s) without Russian outside the scope:\n` + rest.map((r) => `  ${r.n}  ${r.file}`).join("\n"));
    }
    expect(true).toBe(true);
  });
});
