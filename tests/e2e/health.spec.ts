import { test, expect } from "@playwright/test";
import { BASE } from "./helpers";

// Keep in step with MAX_STREAMS in src/app/api/health/stream/route.ts.
const MAX_STREAMS = 5;
const STREAM = `${BASE}/api/health/stream`;

type Open = { res: Response; stop: () => void };

async function open(): Promise<Open> {
  const ctrl = new AbortController();
  const res = await fetch(STREAM, { signal: ctrl.signal });
  return { res, stop: () => ctrl.abort() };
}

/**
 * Opens a stream, waiting a little if the server says "busy": a stream that an earlier test just aborted keeps its
 * slot until the server notices the disconnect.
 */
async function openWhenFree(): Promise<Open> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const s = await open();
    if (s.res.status !== 429 || Date.now() > deadline) return s;
    s.stop();
    await new Promise((r) => setTimeout(r, 250));
  }
}

test("health check answers ok without caching", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
  expect(res.headers()["cache-control"]).toBe("no-store");
});

test("health stream arrives piece by piece, not all at once", async () => {
  const s = await openWhenFree();
  try {
    expect(s.res.status).toBe(200);
    expect(s.res.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
    expect(s.res.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(s.res.headers.get("x-accel-buffering")).toBe("no");

    const reader = s.res.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let chunks = 0;
    const readUntil = async (marker: string) => {
      while (!text.includes(marker)) {
        const { done, value } = await reader.read();
        if (done) throw new Error(`Stream ended before "${marker}"`);
        chunks += 1;
        text += decoder.decode(value, { stream: true });
      }
      return Date.now();
    };

    const first = await readUntil("data: tick 1\n\n");
    expect(text).toContain("retry: 3000\n\n");
    expect(text).not.toContain("tick 2"); // the second event must not ride along with the first
    const second = await readUntil("data: tick 2\n\n");
    expect(chunks).toBeGreaterThanOrEqual(2);
    expect(second - first).toBeGreaterThanOrEqual(1500);
  } finally {
    s.stop();
  }
});

test("health stream refuses one more than the concurrent limit", async () => {
  const streams: Open[] = [];
  try {
    for (let i = 0; i < MAX_STREAMS; i++) {
      const s = await openWhenFree();
      streams.push(s);
      expect(s.res.status).toBe(200);
    }
    const extra = await open();
    streams.push(extra);
    expect(extra.res.status).toBe(429);
    expect(typeof (await extra.res.json()).error).toBe("string");
  } finally {
    for (const s of streams) s.stop();
  }
  // Leaving gives the slots back: a new stream is accepted again.
  const again = await openWhenFree();
  again.stop();
  expect(again.res.status).toBe(200);
});
