import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;
/** A database that does not answer in this long counts as down. */
const DB_TIMEOUT_MS = 3000;

/**
 * Liveness check: says only that the process answers. No sign-in, no database call (a paused database must not
 * make the service look dead), and nothing about versions or settings. This is what Render's health check calls.
 *
 * `?db=1` also asks the database one trivial question (SELECT 1). That is for the outside monitor (UptimeRobot) only:
 * it keeps the free Supabase project from pausing after a quiet week, which the cached home page no longer does by
 * accident, and it turns a dead database into a 503 the monitor can alert on. It answers with "ok" or "down" and
 * nothing else, and it is limited per address because anyone can call it.
 */
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("db") !== "1") {
    return NextResponse.json({ status: "ok" }, { status: 200, headers: NO_STORE });
  }
  if (!rateLimit(`health-db:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ status: "ok" }, { status: 429, headers: { ...NO_STORE, "Retry-After": "60" } });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("database timeout")), DB_TIMEOUT_MS);
      }),
    ]);
    return NextResponse.json({ status: "ok", db: "ok" }, { status: 200, headers: NO_STORE });
  } catch {
    return NextResponse.json({ status: "degraded", db: "down" }, { status: 503, headers: NO_STORE });
  } finally {
    clearTimeout(timer);
  }
}
