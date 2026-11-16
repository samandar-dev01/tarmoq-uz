import { describe, expect, it } from "vitest";
import { langCookie, localeOfRequest, otherLocale, parseLocale, resolveLocale } from "@/i18n/config";
import { interpolate, msg, tk, translate, translator } from "@/i18n/dictionary";
import { hreflang, isPublicPath, localHref, proxyDecision, stripLocalePrefix } from "@/i18n/paths";
import { plural, pluralRu } from "@/i18n/plural";
import { RU_SERVER, translateRendered } from "@/i18n/rendered";
import { RU, UI_FRAGMENTS } from "@/i18n/ru";
import { errors } from "@/i18n/ru/errors";
import { categoryName, CITIES, labelFor, LANGUAGES } from "@/lib/constants";
import { formatDate, formatDay, formatMoment, formatUZS } from "@/lib/format";

// The language machinery: the dictionary, counted words, addresses, the proxy's decision, money and dates.

const NBSP = "\u00a0";

describe("translate", () => {
  it("returns the Uzbek key itself, byte for byte", () => {
    for (const key of ["Kirish", "Yorugʻ rejimga oʻtish", "Roʻyxatdan oʻtish", "no such key at all"]) expect(translate("uz", key)).toBe(key);
  });
  it("looks Russian up and falls back to the key when there is no entry", () => {
    expect(translate("ru", "Chiqish")).toBe("Выйти");
    expect(translate("ru", "no such key at all")).toBe("no such key at all");
  });
  it("fills placeholders in both languages and leaves an unknown one as written", () => {
    expect(translate("uz", "Hisob menyusi: {name}", { name: "Demo Client" })).toBe("Hisob menyusi: Demo Client");
    expect(translate("ru", "Hisob menyusi: {name}", { name: "Demo Client" })).toBe("Меню аккаунта: Demo Client");
    expect(interpolate("{a} va {b}", { a: 1 })).toBe("1 va {b}");
  });
  it("translator, tk and msg are thin helpers over it", () => {
    expect(translator("ru")("Kabinet")).toBe("Кабинет");
    expect(tk("Kabinet")).toBe("Kabinet");
    expect(msg("Fayl {max} MB dan katta boʻlmasin.", { max: 100 })).toBe("Fayl 100 MB dan katta boʻlmasin.");
  });
  it("the language button's name ends with the other language's own name", () => {
    expect(translate("uz", "Tilni almashtirish: {language}", { language: "Русский" })).toBe("Tilni almashtirish: Русский");
    expect(translate("ru", "Tilni almashtirish: {language}", { language: "Oʻzbekcha" })).toBe("Сменить язык: Oʻzbekcha");
  });
});

describe("the Russian fragments", () => {
  const all: [string, Record<string, string>][] = [...Object.entries(UI_FRAGMENTS), ["errors", errors]];
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

  it("keep the key's placeholders, have no empty text and no Uzbek apostrophe letters", () => {
    const problems: string[] = [];
    for (const [name, fragment] of all) {
      for (const [key, ru] of Object.entries(fragment)) {
        if (!ru.trim()) problems.push(`${name}: empty Russian for "${key}"`);
        if (placeholders(key) !== placeholders(ru)) problems.push(`${name}: placeholders differ for "${key}"`);
        if (/[ʻʼ]/.test(ru)) problems.push(`${name}: Uzbek letter in the Russian for "${key}"`);
      }
    }
    expect(problems).toEqual([]);
  });
  it("never translate one key in two fragments", () => {
    const seen = new Map<string, string>();
    const twice: string[] = [];
    for (const [name, fragment] of all) {
      for (const key of Object.keys(fragment)) {
        if (seen.has(key)) twice.push(`"${key}" is in ${seen.get(key)} and ${name}`);
        seen.set(key, name);
      }
    }
    expect(twice).toEqual([]);
  });
  it("the merged tables hold every entry", () => {
    expect(Object.keys(RU).length).toBe(Object.values(UI_FRAGMENTS).reduce((n, f) => n + Object.keys(f).length, 0));
    expect(Object.keys(RU_SERVER).length).toBe(Object.keys(RU).length + Object.keys(errors).length);
  });
});

describe("finished sentences (the server boundary)", () => {
  it("passes Uzbek through and translates an exact sentence", () => {
    expect(translateRendered("uz", "Buyurtma topilmadi.")).toBe("Buyurtma topilmadi.");
    expect(translateRendered("ru", "Buyurtma topilmadi.")).toBe("Заказ не найден.");
  });
  it("recognises a template whose values were already filled in", () => {
    expect(translateRendered("ru", "Hisob menyusi: Aziz Karimov")).toBe("Меню аккаунта: Aziz Karimov");
    expect(translateRendered("ru", "Urinishlar juda koʻp. 15 daqiqadan keyin qayta urinib koʻring.")).toBe("Слишком много попыток. Попробуйте снова через 15 мин.");
  });
  it("leaves unknown text alone", () => {
    expect(translateRendered("ru", "Required")).toBe("Required");
  });
});

describe("plural", () => {
  const forms = ["отзыв", "отзыва", "отзывов"] as const;
  it("picks the Russian form by the hand-written rule", () => {
    const expected: Record<number, string> = { 0: "отзывов", 1: "отзыв", 2: "отзыва", 4: "отзыва", 5: "отзывов", 11: "отзывов", 12: "отзывов", 14: "отзывов", 21: "отзыв", 22: "отзыва", 25: "отзывов", 101: "отзыв", 111: "отзывов", 112: "отзывов", 122: "отзыва" };
    for (const [n, word] of Object.entries(expected)) expect(pluralRu(Number(n), forms), n).toBe(word);
  });
  it("writes the number with its word in each language", () => {
    for (const n of [1, 2, 5, 11, 12, 21, 22, 25, 101]) expect(plural("uz", n, "sharh", forms)).toBe(`${n} ta sharh`);
    expect([1, 2, 5, 11, 12, 21, 22, 25, 101].map((n) => plural("ru", n, "sharh", forms))).toEqual([
      "1 отзыв", "2 отзыва", "5 отзывов", "11 отзывов", "12 отзывов", "21 отзыв", "22 отзыва", "25 отзывов", "101 отзыв",
    ]);
  });
});

describe("which language a request is in", () => {
  it("parseLocale accepts only the exact word ru", () => {
    expect(parseLocale("ru")).toBe("ru");
    for (const v of ["uz", "RU", "ru ", "", "en", "ru,uz", null, undefined]) expect(parseLocale(v)).toBe("uz");
    expect(otherLocale("uz")).toBe("ru");
    expect(otherLocale("ru")).toBe("uz");
    expect(langCookie("ru")).toBe("lang=ru; Path=/; Max-Age=31536000; SameSite=Lax");
  });
  it("is always Uzbek while Russian is off, whatever the request carries", () => {
    expect(resolveLocale("ru", "ru", false)).toBe("uz");
    const req = new Request("http://x/api", { headers: { cookie: "lang=ru", "x-locale": "ru" } });
    expect(localeOfRequest(req, false)).toBe("uz");
    expect(localeOfRequest(req)).toBe("uz"); // the default: the switch in src/i18n/config.ts is off
  });
  it("with Russian on: the proxy's header first, then the cookie, else Uzbek", () => {
    expect(resolveLocale("ru", "uz", true)).toBe("ru");
    expect(resolveLocale(null, "ru", true)).toBe("ru");
    expect(resolveLocale(null, undefined, true)).toBe("uz");
    expect(resolveLocale("en", "de", true)).toBe("uz");
    const cookie = (c: string) => localeOfRequest(new Request("http://x/api", { headers: { cookie: c } }), true);
    expect(cookie("theme=light; lang=ru; session=abc")).toBe("ru");
    expect(cookie("xlang=ru; theme=light")).toBe("uz");
    expect(cookie("lang=uz")).toBe("uz");
  });
});

describe("addresses", () => {
  it("only the home page, the search and a creator's page have a Russian address", () => {
    for (const p of ["/", "/search", "/providers/jasur-karimov"]) expect(isPublicPath(p), p).toBe(true);
    for (const p of ["/login", "/providers", "/providers/a/b", "/searching", "/orders/1", "/admin", "/api/health"]) expect(isPublicPath(p), p).toBe(false);
  });
  it("localHref prefixes public pages in Russian and nothing else", () => {
    expect(localHref("ru", "/")).toBe("/ru");
    expect(localHref("ru", "/search")).toBe("/ru/search");
    expect(localHref("ru", "/search?city=Toshkent&page=2")).toBe("/ru/search?city=Toshkent&page=2");
    expect(localHref("ru", "/providers/jasur-karimov#packages")).toBe("/ru/providers/jasur-karimov#packages");
    expect(localHref("ru", "/?q=1")).toBe("/ru?q=1");
    for (const p of ["/login?role=client", "/register?role=provider", "/messages", "/dashboard/client", "/orders/new?service=1", "/admin"]) expect(localHref("ru", p)).toBe(p);
    for (const p of ["/", "/search?city=x", "/providers/a", "/login"]) expect(localHref("uz", p)).toBe(p);
  });
  it("stripLocalePrefix is the way back", () => {
    expect(stripLocalePrefix("/ru")).toBe("/");
    expect(stripLocalePrefix("/ru/search")).toBe("/search");
    expect(stripLocalePrefix("/russia")).toBe("/russia");
    expect(stripLocalePrefix("/search")).toBe("/search");
  });
  it("hreflang gives uz, ru and x-default for a public page, and nothing while Russian is off", () => {
    expect(hreflang("/search", true)).toEqual({ uz: "/search", ru: "/ru/search", "x-default": "/search" });
    expect(hreflang("/", true)).toEqual({ uz: "/", ru: "/ru", "x-default": "/" });
    expect(hreflang("/login", true)).toBeUndefined();
    expect(hreflang("/search", false)).toBeUndefined();
    expect(hreflang("/search")).toBeUndefined();
  });
});

describe("the proxy's decision", () => {
  it("does nothing at all while Russian is off", () => {
    for (const p of ["/ru", "/ru/search", "/ru/providers/a", "/ru/login", "/search"]) expect(proxyDecision(p, false)).toEqual({ kind: "pass" });
  });
  it("shows the three public pages in Russian", () => {
    expect(proxyDecision("/ru", true)).toEqual({ kind: "rewrite", to: "/" });
    expect(proxyDecision("/ru/", true)).toEqual({ kind: "rewrite", to: "/" });
    expect(proxyDecision("/ru/search", true)).toEqual({ kind: "rewrite", to: "/search" });
    expect(proxyDecision("/ru/providers/jasur-karimov", true)).toEqual({ kind: "rewrite", to: "/providers/jasur-karimov" });
  });
  it("sends every other /ru/... address to the page's one address", () => {
    expect(proxyDecision("/ru/login", true)).toEqual({ kind: "redirect", to: "/login" });
    expect(proxyDecision("/ru/orders/abc", true)).toEqual({ kind: "redirect", to: "/orders/abc" });
    expect(proxyDecision("/ru/providers", true)).toEqual({ kind: "redirect", to: "/providers" });
    expect(proxyDecision("/ru/providers/a/b", true)).toEqual({ kind: "redirect", to: "/providers/a/b" });
    expect(proxyDecision("/ru/api/health", true)).toEqual({ kind: "redirect", to: "/api/health" });
    expect(proxyDecision("/ru/ru/search", true)).toEqual({ kind: "redirect", to: "/search" });
    expect(proxyDecision("/ru/ru", true)).toEqual({ kind: "redirect", to: "/" });
  });
  it("leaves addresses that only look alike", () => {
    for (const p of ["/", "/search", "/russia", "/rules"]) expect(proxyDecision(p, true)).toEqual({ kind: "pass" });
  });
});

describe("money and dates", () => {
  it("formatUZS keeps the Uzbek text and has a Russian one, both with non-breaking spaces", () => {
    expect(formatUZS(300000)).toBe(`300${NBSP}000${NBSP}soʻm`);
    expect(formatUZS(1500000, "uz")).toBe(`1${NBSP}500${NBSP}000${NBSP}soʻm`);
    expect(formatUZS(300000, "ru")).toBe(`300${NBSP}000${NBSP}сум`);
    expect(formatUZS(999, "ru")).toBe(`999${NBSP}сум`);
  });
  it("dates: Uzbek unchanged, Russian with the month in the genitive", () => {
    const event = new Date(Date.UTC(2026, 10, 15));
    expect(formatDate(event)).toBe("15-noyabr, 2026");
    expect(formatDate(event, "ru")).toBe("15 ноября 2026");
    const late = new Date(Date.UTC(2026, 11, 31, 20, 5)); // 01:05 on 1 January in Tashkent
    expect(formatDay(late)).toBe("1-yanvar, 2027");
    expect(formatDay(late, "ru")).toBe("1 января 2027");
    expect(formatMoment(late)).toBe("1-yanvar, 01:05");
    expect(formatMoment(late, "ru")).toBe("1 января, 01:05");
    const months = Array.from({ length: 12 }, (_, m) => formatDate(new Date(Date.UTC(2026, m, 3)), "ru").split(" ")[1]);
    expect(months).toEqual(["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]);
  });
});

describe("labels for stored values", () => {
  it("every city and language has a Russian label, and the Uzbek one is the stored value", () => {
    for (const value of [...CITIES, ...LANGUAGES]) {
      expect(labelFor("uz", value)).toBe(value);
      expect(labelFor("ru", value), value).not.toBe(value);
      expect(labelFor("ru", value), value).toMatch(/^[А-ЯЁ][а-яё]+$/);
    }
    expect(labelFor("ru", "Toshkent")).toBe("Ташкент");
    expect(labelFor("ru", "something a creator typed")).toBe("something a creator typed");
  });
  it("a category shows its Russian name only in Russian and only when it has one", () => {
    expect(categoryName("uz", { name: "Fotografiya", nameRu: "Фотография" })).toBe("Fotografiya");
    expect(categoryName("ru", { name: "Fotografiya", nameRu: "Фотография" })).toBe("Фотография");
    expect(categoryName("ru", { name: "Yangi tur", nameRu: null })).toBe("Yangi tur");
    expect(categoryName("ru", { name: "Yangi tur" })).toBe("Yangi tur");
  });
});
