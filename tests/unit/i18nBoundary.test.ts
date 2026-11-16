import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { msg } from "@/i18n/dictionary";
import { handle, HttpError } from "@/lib/http";
import { registerSchema } from "@/lib/validators";

// `handle()` is where the server's Uzbek sentences are put into the language of the request. The handlers themselves
// throw exactly what they always threw.

const req = (headers: Record<string, string> = {}) => new Request("http://localhost/api/x", { headers });
type H = Record<string, string>;
const RU_COOKIE: H = { cookie: "theme=light; lang=ru" };

const notFound = handle(async () => {
  throw new HttpError(404, "Buyurtma topilmadi.", { code: "X" }, { "Retry-After": "7" });
});
const badForm = handle(async () => {
  registerSchema.parse({ name: "A", email: "nope", password: "short", role: "CLIENT" });
  return new Response("unreachable");
});
const withValue = handle(async () => {
  throw new HttpError(429, msg("Urinishlar juda koʻp. {minutes} daqiqadan keyin qayta urinib koʻring.", { minutes: 3 }));
});
const crash = handle(async () => {
  throw new Error("boom");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Russian off (the default)", () => {
  it("answers in Uzbek, byte for byte, even to a request that asks for Russian", async () => {
    for (const headers of ([{}, RU_COOKIE, { "x-locale": "ru" }] as H[])) {
      const res = await notFound(req(headers));
      expect(res.status).toBe(404);
      expect(res.headers.get("Retry-After")).toBe("7");
      expect(await res.text()).toBe('{"error":"Buyurtma topilmadi.","details":{"code":"X"}}');
    }
    const form = await (await badForm(req(RU_COOKIE))).json();
    expect(form.error).toBe("Belgilangan maydonlarni tekshiring.");
    expect(form.fieldErrors).toEqual({
      name: ["Ism-familiyangizni kiriting"],
      email: ["Email manzilini toʻgʻri kiriting"],
      password: ["Parol kamida 8 ta belgidan iborat boʻlsin"],
    });
  });
});

describe("Russian on (RUSSIAN_LIVE=1 in the environment)", () => {
  it("translates an HttpError for a Russian request and keeps status, details and headers", async () => {
    vi.stubEnv("RUSSIAN_LIVE", "1");
    for (const headers of ([RU_COOKIE, { "x-locale": "ru" }, { "x-locale": "ru", cookie: "lang=uz" }] as H[])) {
      const res = await notFound(req(headers));
      expect(res.status).toBe(404);
      expect(res.headers.get("Retry-After")).toBe("7");
      expect(await res.json()).toEqual({ error: "Заказ не найден.", details: { code: "X" } });
    }
  });
  it("still answers an Uzbek request in Uzbek", async () => {
    vi.stubEnv("RUSSIAN_LIVE", "1");
    for (const headers of ([{}, { cookie: "lang=uz" }, { cookie: "lang=en" }] as H[])) {
      expect((await (await notFound(req(headers))).json()).error).toBe("Buyurtma topilmadi.");
    }
  });
  it("translates the zod summary, the field errors and the issues", async () => {
    vi.stubEnv("RUSSIAN_LIVE", "1");
    const res = await badForm(req(RU_COOKIE));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Проверьте отмеченные поля.");
    expect(body.fieldErrors).toEqual({
      name: ["Введите имя и фамилию"],
      email: ["Введите правильный email"],
      password: ["Пароль должен быть не короче 8 символов"],
    });
    expect(body.issues).toContainEqual({ path: "email", message: "Введите правильный email" });
  });
  it("translates a message that carries a value", async () => {
    vi.stubEnv("RUSSIAN_LIVE", "1");
    expect((await (await withValue(req())).json()).error).toBe("Urinishlar juda koʻp. 3 daqiqadan keyin qayta urinib koʻring.");
    expect((await (await withValue(req(RU_COOKIE))).json()).error).toBe("Слишком много попыток. Попробуйте снова через 3 мин.");
  });
  it("translates the cross-site refusal and the unknown-error sentence", async () => {
    vi.stubEnv("RUSSIAN_LIVE", "1");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const crashed = await crash(req(RU_COOKIE));
    expect(crashed.status).toBe(500);
    expect((await crashed.json()).error).toBe("Что-то пошло не так. Попробуйте ещё раз.");
    const foreign = new Request("http://localhost/api/x", { method: "POST", headers: { ...RU_COOKIE, origin: "https://evil.example", host: "localhost" } });
    const refused = await notFound(foreign);
    expect(refused.status).toBe(403);
    expect((await refused.json()).error).toBe("Запрос отправлен с другого сайта и отклонён.");
  });
  it("leaves a message with no Russian entry as it was thrown", async () => {
    vi.stubEnv("RUSSIAN_LIVE", "1");
    const odd = handle(async () => {
      z.object({ n: z.number() }).parse({ n: "x" });
      return new Response("unreachable");
    });
    expect((await (await odd(req(RU_COOKIE))).json()).fieldErrors.n).toEqual(["Expected number, received string"]);
  });
});
