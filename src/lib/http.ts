import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { HttpError } from "./errors";
export { HttpError };

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Wrap every route handler: converts HttpError / ZodError / unknown errors into JSON responses. */
export function handle<A extends unknown[]>(fn: (req: Request, ...args: A) => Promise<Response>) {
  return async (req: Request, ...args: A): Promise<Response> => {
    try {
      return await fn(req, ...args);
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
      }
      if (e instanceof ZodError) {
        return NextResponse.json(
          {
            error: "Please check the highlighted fields.",
            fieldErrors: e.flatten().fieldErrors,
            issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          },
          { status: 400 },
        );
      }
      console.error("Unhandled API error:", e);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Invalid request body.");
  }
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
