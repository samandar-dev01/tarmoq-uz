import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { LIMITS, clearAllLimits, isLimited, otpAllowed, rateLimit, recordFailure, resetLimit, retryAfterSeconds } from "@/lib/rateLimit";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  clearAllLimits();
});
afterEach(() => vi.useRealTimers());

describe("rate limiter (P0-2)", () => {
  it("blocks one address for one email after 5 failed logins, for the rest of the 15 minutes", () => {
    const { limit, windowMs } = LIMITS.loginPerPair;
    const key = "login:pair:a@b.c|1.2.3.4";
    for (let i = 0; i < 4; i++) recordFailure(key, windowMs);
    expect(isLimited(key, limit)).toBe(false);
    recordFailure(key, windowMs);
    expect(isLimited(key, limit)).toBe(true);
    expect(retryAfterSeconds(key)).toBe(900);

    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(isLimited(key, limit)).toBe(true);
    expect(retryAfterSeconds(key)).toBe(300);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(isLimited(key, limit)).toBe(false);
  });

  // SECURITY FIX (vibeguard #6): a stranger's wrong guesses must not lock the real owner out.
  it("a stranger's 5 failures lock out only the stranger's address, not the owner's", () => {
    const { limit, windowMs } = LIMITS.loginPerPair;
    for (let i = 0; i < 5; i++) recordFailure("login:pair:owner@b.c|9.9.9.9", windowMs); // the stranger
    expect(isLimited("login:pair:owner@b.c|9.9.9.9", limit)).toBe(true);
    expect(isLimited("login:pair:owner@b.c|5.5.5.5", limit)).toBe(false); // the owner, elsewhere
    // ...and the email-wide counter stays far below its own cap, so the owner is not blocked there either.
    for (let i = 0; i < 5; i++) recordFailure("login:email:owner@b.c", LIMITS.loginPerEmail.windowMs);
    expect(isLimited("login:email:owner@b.c", LIMITS.loginPerEmail.limit)).toBe(false);
  });

  it("still stops guessing spread over many addresses: 30 failures for one email, from anywhere", () => {
    const { limit, windowMs } = LIMITS.loginPerEmail;
    expect(limit).toBe(30);
    for (let i = 0; i < 29; i++) recordFailure("login:email:a@b.c", windowMs);
    expect(isLimited("login:email:a@b.c", limit)).toBe(false);
    recordFailure("login:email:a@b.c", windowMs);
    expect(isLimited("login:email:a@b.c", limit)).toBe(true);
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
