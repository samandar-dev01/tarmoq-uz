import { describe, it, expect, vi, afterEach } from "vitest";
import { SUPPORT_ALERT_EVERY_MS, needsAnswer, shouldAlert, unreadForUser } from "@/lib/support";
import { supportMessageMessage } from "@/lib/notify";

const at = (ms: number) => new Date(1_700_000_000_000 + ms);

describe("support: when the owner is pinged", () => {
  it("pings for the first message of a thread", () => {
    expect(shouldAlert(null, at(0))).toBe(true);
  });

  it("stays quiet for 10 minutes after a ping, then pings again", () => {
    const pinged = at(0);
    expect(shouldAlert(pinged, at(SUPPORT_ALERT_EVERY_MS - 1))).toBe(false);
    expect(shouldAlert(pinged, at(SUPPORT_ALERT_EVERY_MS))).toBe(true);
    expect(shouldAlert(pinged, at(SUPPORT_ALERT_EVERY_MS * 3))).toBe(true);
  });
});

describe("support: who has something to read", () => {
  const msgs = [
    { fromStaff: false, createdAt: at(1000) },
    { fromStaff: true, createdAt: at(2000) },
    { fromStaff: true, createdAt: at(3000) },
  ];

  it("counts only staff messages newer than the person's last look", () => {
    expect(unreadForUser(msgs, null)).toBe(2);
    expect(unreadForUser(msgs, at(2000))).toBe(1);
    expect(unreadForUser(msgs, at(3000))).toBe(0);
  });

  it("a thread needs an answer when the person wrote last and no admin has opened it since", () => {
    expect(needsAnswer({ lastMessageAt: at(5000), staffReadAt: null, lastFromStaff: false })).toBe(true);
    expect(needsAnswer({ lastMessageAt: at(5000), staffReadAt: at(4000), lastFromStaff: false })).toBe(true);
    expect(needsAnswer({ lastMessageAt: at(5000), staffReadAt: at(6000), lastFromStaff: false })).toBe(false);
    expect(needsAnswer({ lastMessageAt: at(5000), staffReadAt: null, lastFromStaff: true })).toBe(false);
  });
});

describe("support: the Telegram text", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("names who wrote and links to the thread, and has no way to carry the message", () => {
    vi.stubEnv("APP_URL", "https://tarmoq-uz.onrender.com/");
    const text = supportMessageMessage({ name: "Madina", role: "CLIENT", threadId: "clx123" });
    expect(text).toContain("Madina (CLIENT) wrote to the support team.");
    expect(text).toContain("https://tarmoq-uz.onrender.com/admin/support/clx123");
    expect(text.split("\n")).toHaveLength(2);
  });

  it("makes a hostile name one plain line", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("RENDER_EXTERNAL_URL", "");
    const text = supportMessageMessage({ name: "Eve\nAnswer: https://evil.test\u0000", role: "PROVIDER", threadId: "a/b" });
    expect(text.split("\n")).toHaveLength(2);
    expect(text).toContain("/admin/support/a%2Fb");
  });
});
