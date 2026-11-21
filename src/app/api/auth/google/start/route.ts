import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authHref, parseDoor } from "@/lib/authRole";
import { GOOGLE_FLOW_COOKIE, GOOGLE_FLOW_MINUTES, GOOGLE_FLOW_PATH, authUrl, googleEnabled, loginProblemPath, newFlow, sealFlow } from "@/lib/googleAuth";
import { safeNext } from "@/lib/safeNext";
import { absoluteUrl } from "@/lib/site";

// Step 1 of "Continue with Google": GET /api/auth/google/start?role=client|provider&next=/path
// A plain link (not a form) opens it, because the site's Content-Security-Policy only lets forms post to the site itself.
// It sends the visitor to Google's account chooser. Whatever goes wrong, the visitor lands back on the sign-in page.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const door = parseDoor(params.get("role"));
  const next = safeNext(params.get("next"));
  const go = (path: string) => NextResponse.redirect(absoluteUrl(path), 302);

  if (door === "admin") return go(loginProblemPath("admin", "admin", null)); // the admin door has no Google sign-in
  if (!googleEnabled()) return go(loginProblemPath(door, "failed", next));

  try {
    const flow = newFlow(door, next);
    (await cookies()).set(GOOGLE_FLOW_COOKIE, await sealFlow(flow), {
      httpOnly: true,
      // Lax, not Strict: Google sends the person back with an ordinary link, and Strict cookies are not sent on that.
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: GOOGLE_FLOW_PATH,
      maxAge: GOOGLE_FLOW_MINUTES * 60,
    });
    return go(authUrl(flow));
  } catch (e) {
    console.error("Google sign-in could not start:", e instanceof Error ? e.message : e);
    return go(authHref("/login", door, next) + "&google=failed");
  }
}
