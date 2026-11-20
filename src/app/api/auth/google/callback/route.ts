import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { startSession } from "@/lib/auth";
import {
  GOOGLE_FLOW_COOKIE,
  GOOGLE_FLOW_PATH,
  GoogleAuthError,
  exchangeCode,
  landingPath,
  loginProblemPath,
  openFlow,
  resolveGoogleUser,
  sameSecret,
  verifyIdToken,
  type GoogleProblem,
} from "@/lib/googleAuth";
import { clientIp } from "@/lib/http";
import { absoluteUrl } from "@/lib/site";

// Step 2 of "Continue with Google": Google sends the person back here with a one-time code.
// Every failure ends the same way: back on the sign-in page, with a short reason it shows, and no session.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const jar = await cookies();
  const flow = await openFlow(jar.get(GOOGLE_FLOW_COOKIE)?.value);
  // One use only: whatever happens next, the flow cookie is gone.
  jar.set(GOOGLE_FLOW_COOKIE, "", { path: GOOGLE_FLOW_PATH, maxAge: 0 });

  const go = (path: string) => NextResponse.redirect(absoluteUrl(path), 302);
  const back = (problem: GoogleProblem, rightDoor?: "client" | "provider" | "admin") =>
    go(loginProblemPath(flow?.door ?? "client", problem, flow?.next ?? null, rightDoor));

  if (!flow) return back("failed"); // no cookie, a forged one, or one older than ten minutes
  const error = params.get("error");
  if (error) return back(error === "access_denied" ? "cancelled" : "failed"); // "Cancel" on Google's screen
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !sameSecret(state, flow.state)) return back("failed");

  let profile;
  try {
    profile = await verifyIdToken(await exchangeCode(code, flow.verifier), flow.nonce);
  } catch (e) {
    if (e instanceof GoogleAuthError && e.reason === "unverified") return back("unverified");
    console.error("Google sign-in refused:", e instanceof GoogleAuthError ? e.reason : e);
    return back("failed");
  }

  let result;
  try {
    result = await resolveGoogleUser(profile, flow.door, clientIp(req));
  } catch (e) {
    console.error("Google sign-in could not find or make the account:", e);
    return back("failed");
  }

  switch (result.kind) {
    case "ok":
      await startSession(result.user);
      return go(landingPath(result.user.role, result.created, flow.next));
    case "wrong_door":
      return back("wrong_door", result.door);
    case "limited":
      return back("limited");
    case "inactive":
      return back("inactive");
    case "admin":
      return back("admin");
    default:
      return back("failed");
  }
}
