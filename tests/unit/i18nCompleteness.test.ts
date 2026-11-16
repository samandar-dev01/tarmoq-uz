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
// Server code that returns a message instead of throwing it is read too: `message: "..."` and `invalid("...")` in src/lib and
// src/app/api (the sandbox card rules, the receipt checks), whether or not the file uses zod.
// It also fails on a server message built with a template literal (`...${x}...`), because nothing can translate that:
// write it with msg("... {x} ...", { x }) instead.
//
// SCOPE. Only the files listed in IN_SCOPE are checked, so that a branch is red only for its own work. A later language
// branch WIDENS the list with its folders (for example "src/app/orders/", "src/components/orders/", "src/app/api/orders/");
// the last one replaces the whole list with ["src/"]. An entry is a path from the repo root: a folder ends with "/".
// OUT_OF_SCOPE is what is never translated, on purpose; it is taken out of the scope AND out of the report below, so the final
// state is IN_SCOPE = ["src/"] and this list.
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
  // feat-i18n-public
  "src/app/page.tsx",
  "src/app/search/",
  "src/app/providers/",
  "src/app/not-found.tsx",
  "src/app/error.tsx",
  "src/app/sitemap.ts",
  "src/components/FilterPanel.tsx",
  "src/components/ProviderCard.tsx",
  "src/components/seo/",
  "src/lib/seo.ts",
  "src/lib/providers.ts",
  "src/lib/searchLinks.ts",
  "src/lib/publicFormat.ts",
  // feat-i18n-app: everything a signed-in client or creator sees, and what the server says to them
  "src/app/orders/",
  "src/components/orders/",
  "src/app/checkout/",
  "src/components/checkout/",
  "src/app/dashboard/",
  "src/components/dashboard/",
  "src/components/wizard/",
  "src/app/messages/",
  "src/components/chat/",
  "src/app/api/orders/",
  "src/app/api/payments/",
  "src/app/api/profile/",
  "src/app/api/conversations/",
  "src/app/api/providers/",
  "src/app/api/health/",
  "src/lib/orderUi.ts",
  "src/lib/orderMachine.ts",
  "src/lib/orders.ts",
  "src/lib/agreements.ts",
  "src/lib/messaging.ts",
  "src/lib/payments/",
];

// Never translated, on purpose (decided in the language plan): the admin area is Uzbek only (pages, components, API), the
// Telegram texts stay English (src/lib/notify.ts), and prisma/ (the seed) is outside src/ anyway.
const OUT_OF_SCOPE = ["src/app/admin/", "src/components/admin/", "src/app/api/admin/", "src/lib/notify.ts"];

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
// Messages that code returns or passes on instead of throwing (src/lib, src/app/api), found with or without zod.
const RETURNED_KEYS = [
  new RegExp(`(?<![\\w.])invalid\\(\\s*${STRING}`, "g"),
  new RegExp(`(?<![\\w])message\\s*:\\s*${STRING}`, "g"),
];
const ZOD_KEYS = [
  new RegExp(`\\.(?:min|max|length|email|url|regex|int|positive|nonnegative|nonempty|gte|lte|gt|lt|datetime)\\([^"\\n]*?${STRING}\\s*\\)`, "g"),
  // .refine((u) => u.startsWith("https://"), "message"): the message is the LAST string of the call, not the first.
  new RegExp(`\\.(?:refine|superRefine)\\([^\\n]*,\\s*${STRING}\\s*\\)`, "g"),
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
  else if (file.startsWith("src/lib/") || apiFile) server.push(...RETURNED_KEYS.flatMap(all));
  return { file, ui: apiFile ? [] : marked, server: apiFile ? [...server, ...marked] : server, dynamic: [...code.matchAll(DYNAMIC)].length };
}

const matches = (file: string, entry: string) => (entry.endsWith("/") ? file.startsWith(entry) : file === entry);
const inScope = (file: string) => IN_SCOPE.some((entry) => matches(file, entry)) && !OUT_OF_SCOPE.some((entry) => matches(file, entry));
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
    expect(of("src/app/api/profile/route.ts").dynamic).toBe(0);
    expect(of("src/app/api/profile/route.ts").server).toContain("Profilingiz hali toʻliq emas: {problems}");
    expect(of("src/lib/orderUi.ts").ui).toContain("Soʻrov yuborildi");
    expect(of("src/lib/orderUi.ts").ui).toContain("Tasdiqlangan");
    expect(of("src/components/orders/OrderPanels.tsx").ui).toContain("Nizo ochish");
    expect(of("src/lib/payments/pure.ts").server).toContain("Karta rad etildi.");
    expect(of("src/lib/payments/receiptPure.ts").server).toContain("Fayl juda katta (eng koʻpi {max} MB).");
    expect(found.filter((f) => inScope(f.file)).reduce((n, f) => n + f.ui.length + f.server.length, 0)).toBeGreaterThan(80);
  });

  it("in the files that are in scope for this branch", () => {
    expect(found.filter((f) => inScope(f.file)).flatMap(missing)).toEqual([]);
  });

  it("reports what is left outside the scope (never fails)", () => {
    const rest = found.filter((f) => !inScope(f.file) && !OUT_OF_SCOPE.some((entry) => matches(f.file, entry))).map((f) => ({ file: f.file, n: missing(f).length })).filter((r) => r.n > 0);
    if (rest.length) {
      console.info(`i18n: ${rest.reduce((n, r) => n + r.n, 0)} key(s) without Russian outside the scope:\n` + rest.map((r) => `  ${r.n}  ${r.file}`).join("\n"));
    }
    // What the scanner cannot see: Uzbek text that nobody wrapped. A file outside the scope that still has Uzbek letters
    // (ʻ ʼ) on a line with no t( / tk( / msg( / HttpError( is a page waiting for its language branch.
    const wrapped = /(?<![\w.])(?:t|tk|msg)\(|HttpError\(/;
    const unwrapped = files(SRC)
      .map((p) => ({ file: relative(ROOT, p).split("\\").join("/"), p }))
      .filter(({ file }) => !file.startsWith("src/i18n/") && !inScope(file) && !OUT_OF_SCOPE.some((entry) => matches(file, entry)))
      .map(({ file, p }) => ({
        file,
        n: readFileSync(p, "utf8").split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line) && /[ʻʼ]/.test(line) && !wrapped.test(line)).length,
      }))
      .filter((r) => r.n > 0);
    if (unwrapped.length) {
      console.info(`i18n: ${unwrapped.reduce((n, r) => n + r.n, 0)} line(s) with Uzbek text that is not wrapped, outside the scope:\n` + unwrapped.map((r) => `  ${r.n}  ${r.file}`).join("\n"));
    }
    expect(true).toBe(true);
  });
});
