import { clientIp, handle, HttpError } from "@/lib/http";
import { rateLimit, retryAfterSeconds } from "@/lib/rateLimit";
import { createSlotLimiter } from "@/lib/streamSlots";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * A public Server-Sent Events test stream. Its only job is to prove that a slow, streamed answer reaches the
 * visitor piece by piece through the host's proxy:
 *
 *   curl -N https://<site>/api/health/stream
 *
 * should print "data: tick 1", then one more line about every 2 seconds, and stop after a minute. If everything
 * arrives at once at the end, something in between is buffering. It sends no data about anyone.
 *
 * Abuse limits (each open stream holds a connection for up to a minute):
 *  - at most MAX_STREAMS open at once in the whole process;
 *  - at most PER_CLIENT.limit starts per address per minute.
 */
const TICK_MS = 2000;
const TICKS = 30; // tick 1 at once, the last one 58 s later, closed at 60 s
const MAX_STREAMS = 5;
const PER_CLIENT = { limit: 10, windowMs: 60 * 1000 };

const slots = createSlotLimiter(MAX_STREAMS);
const BUSY = "Sinov oqimlari band. Birozdan keyin qayta urinib koʻring.";

export const GET = handle(async (req) => {
  const key = `health-stream:${clientIp(req)}`;
  if (!rateLimit(key, PER_CLIENT.limit, PER_CLIENT.windowMs)) {
    throw new HttpError(429, BUSY, undefined, { "Retry-After": String(retryAfterSeconds(key)), "Cache-Control": "no-store" });
  }
  const release = slots.acquire();
  if (!release) throw new HttpError(429, BUSY, undefined, { "Retry-After": "5", "Cache-Control": "no-store" });

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let finished = false;
  // Every way the stream can end (all ticks sent, the visitor left, the reader cancelled) goes through here once.
  const finish = () => {
    if (finished) return;
    finished = true;
    if (timer) clearInterval(timer);
    req.signal.removeEventListener("abort", onAbort);
    release();
  };
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined;
  const onAbort = () => {
    finish();
    try {
      controllerRef?.close();
    } catch {
      /* already closed */
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      if (req.signal.aborted) return onAbort();
      req.signal.addEventListener("abort", onAbort);
      let n = 1;
      controller.enqueue(encoder.encode(`retry: 3000\n\ndata: tick ${n}\n\n`));
      timer = setInterval(() => {
        if (finished) return;
        try {
          if (n >= TICKS) {
            finish();
            controller.close();
            return;
          }
          n += 1;
          controller.enqueue(encoder.encode(`data: tick ${n}\n\n`));
        } catch {
          finish(); // the stream was closed under us
        }
      }, TICK_MS);
    },
    cancel() {
      finish();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
