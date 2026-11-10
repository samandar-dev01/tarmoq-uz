// In-memory limiter: protects a single server instance. Use Redis for multi-instance production.
const hits = new Map<string, { count: number; reset: number }>();

function prune(now: number) {
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
}

/** Counts one hit and returns false once the limit is exceeded. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  prune(now);
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

/** True if the key has already reached the limit (does not count a hit). */
export function isLimited(key: string, limit: number): boolean {
  const entry = hits.get(key);
  return !!entry && entry.reset >= Date.now() && entry.count >= limit;
}

export function recordFailure(key: string, windowMs: number) {
  rateLimit(key, Number.MAX_SAFE_INTEGER, windowMs);
}

export function resetLimit(key: string) {
  hits.delete(key);
}
