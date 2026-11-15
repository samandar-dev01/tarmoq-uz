import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Liveness check: says only that the process answers. No sign-in, no database call (a paused database must not
 * make the service look dead), and nothing about versions or settings.
 */
export function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
