import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { LIMITS, clearAllLimits, isLimited, otpAllowed, rateLimit, recordFailure, resetLimit, retryAfterSeconds } from "@/lib/rateLimit";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  clearAllLimits();
});
afterEach(() => vi.useRealTimers());

describe("rate limiter (P0-2)", () => {
  it("blocks an email after 5 failed logins, for the rest of the 15 minutes", () => {
    const { limit, windowMs } = LIMITS.loginPerEmail;
    for (let i = 0; i < 4; i++) recordFailure("login:email:a@b.c", windowMs);
    expect(isLimited("login:email:a@b.c", limit)).toBe(false);
    recordFailure("login:email:a@b.c", windowMs);
    expect(isLimited("login:email:a@b.c", limit)).toBe(true);
    expect(retryAfterSeconds("login:email:a@b.c")).toBe(900);

    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(isLimited("login:email:a@b.c", limit)).toBe(true);
    expect(retryAfterSeconds("login:email:a@b.c")).toBe(300);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(isLimited("login:email:a@b.c", limit)).toBe(false);
  });

  it("keeps keys apart and can be reset", () => {
    for (let i = 0; i < 5; i++) recordFailure("login:email:a@b.c", 1000);
    expect(isLimited("login:email:x@y.z", 5)).toBe(false);
    resetLimit("login:email:a@b.c");
    expect(isLimited("login:email:a@b.c", 5)).toBe(false);
  });

  it("allows 5 registrations per IP per hour, then refuses", () => {
    const { limit, windowMs } = LIMITS.registerPerIp;
    for (let i = 0; i < 5; i++) expect(rateLimit("register:ip:1.2.3.4", limit, windowMs)).toBe(true);
    expect(rateLimit("register:ip:1.2.3.4", limit, windowMs)).toBe(false);
    vi.advanceTimersByTime(windowMs + 1);
    expect(rateLimit("register:ip:1.2.3.4", limit, windowMs)).toBe(true);
  });

  it("allows 3 OTP codes per phone per 10 minutes, whatever the formatting", () => {
    expect(otpAllowed("+998 90 123 45 67").ok).toBe(true);
    expect(otpAllowed("998901234567").ok).toBe(true);
    expect(otpAllowed("+998-90-123-45-67").ok).toBe(true);
    const fourth = otpAllowed("+998901234567");
    expect(fourth).toEqual({ ok: false, retryAfter: 600 });
    expect(otpAllowed("+998911111111").ok).toBe(true);
  });
});
