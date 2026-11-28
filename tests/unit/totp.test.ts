import { afterEach, describe, expect, it, vi } from "vitest";
import { base32Decode, base32Encode, otpauthUrl, totpCode, totpMatches } from "@/lib/totp";
import { open, seal } from "@/lib/secretBox";
import { mailEnabled } from "@/lib/mail";

// The RFC 6238 test secret: the ASCII "12345678901234567890".
const SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("one-time codes", () => {
  it("match the RFC 6238 SHA-1 values", () => {
    expect(totpCode(SECRET, 59_000, 8)).toBe("94287082");
    expect(totpCode(SECRET, 1111111109_000, 8)).toBe("07081804");
    expect(totpCode(SECRET, 20000000000_000, 8)).toBe("65353130");
  });

  it("allow one step of clock difference and nothing else", () => {
    const now = 1_700_000_000_000;
    expect(totpMatches(SECRET, totpCode(SECRET, now), now)).toBe(true);
    expect(totpMatches(SECRET, totpCode(SECRET, now - 30_000), now)).toBe(true);
    expect(totpMatches(SECRET, totpCode(SECRET, now - 90_000), now)).toBe(false);
    expect(totpMatches(SECRET, "12345", now)).toBe(false);
    expect(totpMatches(SECRET, "abcdef", now)).toBe(false);
  });

  it("round-trips base32 and names the account for the app", () => {
    expect(base32Decode(SECRET).toString()).toBe("12345678901234567890");
    expect(otpauthUrl(SECRET, "a@b.uz")).toContain(`secret=${SECRET}`);
  });
});

describe("stored secrets and mail", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("opens only what was sealed for the same purpose with the same secret", () => {
    vi.stubEnv("AUTH_SECRET", "k3Jx9mQ2vLz8Pw4nTr6YbH1sDf0GcAeU5iVoXyNq7Ms=");
    const box = seal("hello", "totp");
    expect(box).not.toContain("hello");
    expect(open(box, "totp")).toBe("hello");
    expect(() => open(box, "other")).toThrow();
  });

  it("sends no mail until a sender is set, and never logs mail in production", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("MAIL_FROM", "");
    vi.stubEnv("MAIL_DRIVER", "");
    expect(mailEnabled()).toBe(false);
    vi.stubEnv("MAIL_DRIVER", "log");
    vi.stubEnv("NODE_ENV", "production");
    expect(mailEnabled()).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    expect(mailEnabled()).toBe(true);
  });
});
