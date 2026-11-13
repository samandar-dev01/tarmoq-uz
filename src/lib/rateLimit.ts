// In-memory limiter. Chosen because the app runs as ONE instance (render.yaml: a single web service,
// numInstances 1): every request reaches the same process, so a shared store would add a dependency
// and a network hop for nothing. Two consequences to know:
//   - counters are lost when the process restarts (a deploy, or a free instance going to sleep);
//   - the moment a second instance is added, move this to Redis/Upstash, or the limits multiply.
type Entry = { count: number; reset: number };
const hits = new Map<string, Entry>();

function prune(now: number) {
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
}

const live = (key: string, now: number): Entry | undefined => {
  const entry = hits.get(key);
  return entry && entry.reset >= now ? entry : undefined;
};

// The end-to-end suite registers and signs in dozens of accounts from one address. It may switch the
// limiter off, but never in production: there the flag is ignored.
const disabled = () => process.env.RATE_LIMIT_DISABLED === "true" && process.env.NODE_ENV !== "production";

/** Counts one hit and returns false once the limit is exceeded. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  if (disabled()) return true;
  const now = Date.now();
  prune(now);
  const entry = live(key, now);
  if (!entry) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return limit >= 1;
  }
  entry.count += 1;
  return entry.count <= limit;
}

/** True if the key has already reached the limit (does not count a hit). */
export function isLimited(key: string, limit: number): boolean {
  if (disabled()) return false;
  const entry = live(key, Date.now());
  return !!entry && entry.count >= limit;
}

/** Whole seconds until the key's window ends (at least 1), for the Retry-After header. */
export function retryAfterSeconds(key: string): number {
  const now = Date.now();
  const entry = live(key, now);
  return entry ? Math.max(1, Math.ceil((entry.reset - now) / 1000)) : 1;
}

export function recordFailure(key: string, windowMs: number) {
  rateLimit(key, Number.MAX_SAFE_INTEGER, windowMs);
}

export function resetLimit(key: string) {
  hits.delete(key);
}

/** The limits themselves, in one place (P0-2). */
export const LIMITS = {
  loginPerEmail: { limit: 5, windowMs: 15 * 60 * 1000 }, // failed attempts
  loginPerIp: { limit: 20, windowMs: 15 * 60 * 1000 }, // failed attempts
  registerPerIp: { limit: 5, windowMs: 60 * 60 * 1000 },
  otpPerPhone: { limit: 3, windowMs: 10 * 60 * 1000 },
} as const;

/**
 * For any OTP endpoint added later: call it before sending a code. Counts the request and returns
 * `{ ok: false, retryAfter }` once the phone has had 3 codes in 10 minutes.
 */
export function otpAllowed(phone: string): { ok: true } | { ok: false; retryAfter: number } {
  const key = `otp:${phone.replace(/\D/g, "")}`;
  const { limit, windowMs } = LIMITS.otpPerPhone;
  return rateLimit(key, limit, windowMs) ? { ok: true } : { ok: false, retryAfter: retryAfterSeconds(key) };
}

/** Tests only. */
export function clearAllLimits() {
  hits.clear();
}
