import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRaw } }));

import { GET } from "@/app/api/health/route";

let n = 0;
/** A fresh address per test, so the in-memory limiter never carries one test's hits into the next. */
const call = (query = "", ip = `10.8.${Math.floor(++n / 250)}.${(n % 250) + 1}`) =>
  GET(new Request(`http://localhost/api/health${query}`, { headers: { "x-forwarded-for": ip } }));

beforeEach(() => {
  queryRaw.mockReset();
  vi.stubEnv("RATE_LIMIT_DISABLED", "false");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("/api/health", () => {
  it("plain: answers ok and never touches the database (a paused database must not look like a dead service)", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("?db=1: asks the database one question and says ok", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const res = await call("?db=1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", db: "ok" });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("?db=1: a failing database is a 503 that says only 'down', never the error text", async () => {
    queryRaw.mockRejectedValue(new Error("password authentication failed for user postgres"));
    const res = await call("?db=1");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ status: "degraded", db: "down" });
    expect(JSON.stringify(body)).not.toMatch(/password|postgres/i);
  });

  it("?db=1: a database that never answers is a 503 after 3 seconds", async () => {
    vi.useFakeTimers();
    queryRaw.mockReturnValue(new Promise(() => {}));
    const pending = call("?db=1");
    await vi.advanceTimersByTimeAsync(3000);
    const res = await pending;
    expect(res.status).toBe(503);
  });

  it("?db=1: limited per address, the plain check is not", async () => {
    queryRaw.mockResolvedValue([]);
    const ip = "10.7.7.7";
    for (let i = 0; i < 30; i++) expect((await call("?db=1", ip)).status).toBe(200);
    expect((await call("?db=1", ip)).status).toBe(429);
    expect((await call("", ip)).status).toBe(200);
  });
});
