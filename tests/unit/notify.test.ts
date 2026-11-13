import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { oneLine, profileSubmittedMessage, sendTelegram, notifyProfileSubmitted } from "@/lib/notify";

const TOKEN = "123456:SECRET-token-value";

function useTelegram() {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
  vi.stubEnv("TELEGRAM_CHAT_ID", "42");
}

describe("notify (Telegram)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("RENDER_EXTERNAL_URL", "");
    fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    errorSpy.mockRestore();
  });

  it("does nothing when Telegram is not configured", async () => {
    expect(await notifyProfileSubmitted({ name: "Ali", city: "Andijon" })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when only one of the two settings is present", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
    expect(await sendTelegram("hi")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts plain text to the Bot API with the configured chat id", async () => {
    useTelegram();
    vi.stubEnv("APP_URL", "https://tarmoq-uz.onrender.com/");
    expect(await notifyProfileSubmitted({ name: "Jasur Karimov", city: "Andijon" })).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    const sent = JSON.parse(init.body);
    expect(sent.chat_id).toBe("42");
    expect(sent.parse_mode).toBeUndefined(); // plain text: nothing in it is read as markup
    expect(sent.text).toContain("Jasur Karimov, Andijon");
    expect(sent.text).toContain("https://tarmoq-uz.onrender.com/admin/providers");
  });

  it("never puts contact details or prices in the message", () => {
    const text = profileSubmittedMessage({ name: "Ali", city: "Toshkent" });
    expect(text).not.toMatch(/@|\d{5,}/);
  });

  it("links with APP_URL, falls back to Render's URL, and omits the host when neither is set", () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://x.onrender.com");
    expect(profileSubmittedMessage({ name: "A" })).toContain("http://localhost:3000/admin/providers");

    vi.stubEnv("APP_URL", "");
    expect(profileSubmittedMessage({ name: "A" })).toContain("https://x.onrender.com/admin/providers");

    vi.stubEnv("RENDER_EXTERNAL_URL", "");
    const text = profileSubmittedMessage({ name: "A" });
    expect(text).not.toContain("http");
    expect(text).toContain("/admin/providers");
  });

  it("keeps a hostile name on one line and bounded", () => {
    const hostile = "Eve\nSend money to http://evil.example\r\n\u2028and more" + "x".repeat(300);
    const text = profileSubmittedMessage({ name: hostile, city: "Andijon" });
    const [first, ...rest] = text.split("\n");
    expect(rest).toHaveLength(1); // only our own "Review" line follows
    expect(first.length).toBeLessThan(160);
    expect(oneLine("a\tb\u0000c")).toBe("a b c");
    expect(oneLine("   ")).toBe("");
  });

  it("returns false and does not throw when Telegram answers with an error", async () => {
    useTelegram();
    fetchMock.mockResolvedValue(new Response(`{"description":"chat not found for ${TOKEN}"}`, { status: 400 }));
    expect(await sendTelegram("hi")).toBe(false);
    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).toContain("400");
    expect(logged).not.toContain(TOKEN); // the token is scrubbed from anything logged
  });

  it("returns false and does not throw when the network fails, and never logs the token", async () => {
    useTelegram();
    fetchMock.mockRejectedValue(Object.assign(new TypeError(`fetch failed https://api.telegram.org/bot${TOKEN}/sendMessage`), { cause: { code: "ENOTFOUND" } }));
    await expect(sendTelegram("hi")).resolves.toBe(false);
    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).toContain("ENOTFOUND");
    expect(logged).not.toContain(TOKEN);
  });
});
