// "Continue with Google": the authorization-code flow with PKCE, written with `fetch` and `jose` (no new package).
//
//   /api/auth/google/start     makes a one-use "flow" (state, nonce, PKCE verifier, the door, `next`), seals it into a short
//                              cookie and sends the visitor to Google's account chooser.
//   /api/auth/google/callback  opens the flow, trades Google's code for an ID token on the server (the client secret never
//                              reaches the browser), checks the token, and signs the person in.
//
// Two promises the owner asked for, kept here and nowhere else:
//   1. Only a Google account whose email Google itself marks verified is accepted (`verifyIdToken`).
//   2. The person chooses their own Google account every time (`prompt=select_account` in `authUrl`).
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTVerifyGetKey } from "jose";
import { logAudit } from "./audit";
import { ROLE_HOME, authHref, wrongDoor, type Door, type EntryRole } from "./authRole";
import { prisma } from "./db";
import { LIMITS, rateLimit, retryAfterSeconds } from "./rateLimit";
import { safeNext } from "./safeNext";
import { siteUrl } from "./site";
import { authKey, type AppRole } from "./token";

export const GOOGLE_FLOW_COOKIE = "g_oauth";
/** The flow cookie is only ever sent to the two Google routes. */
export const GOOGLE_FLOW_PATH = "/api/auth/google";
export const GOOGLE_FLOW_MINUTES = 10;
const CALLBACK_PATH = "/api/auth/google/callback";
const FLOW_AUDIENCE = "tarmoq-google-flow"; // a session token can never open a flow, nor a flow be used as a session
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export type GoogleProblem = "cancelled" | "unverified" | "admin" | "inactive" | "wrong_door" | "limited" | "failed" | "two_factor";

export class GoogleAuthError extends Error {
  constructor(public reason: "not_configured" | "exchange" | "invalid_token" | "unverified") {
    super(`Google sign-in: ${reason}`);
  }
}

// ---- configuration ----------------------------------------------------------------------------------------------

export function googleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** False until both values are set: the sign-in pages show no Google button, so nothing half-working is ever shown. */
export const googleEnabled = () => googleConfig() !== null;

/** The address Google sends the person back to. It must be listed, exactly, in the Google Cloud OAuth client. */
export const redirectUri = () => `${siteUrl()}${CALLBACK_PATH}`;

// ---- the one-use flow cookie ------------------------------------------------------------------------------------

export type Flow = { state: string; nonce: string; verifier: string; door: EntryRole; next: string | null };

export function newFlow(door: EntryRole, next: string | null): Flow {
  return {
    state: randomBytes(24).toString("base64url"),
    nonce: randomBytes(24).toString("base64url"),
    verifier: randomBytes(48).toString("base64url"), // 64 characters; PKCE allows 43 to 128
    door,
    next: safeNext(next),
  };
}

export async function sealFlow(flow: Flow): Promise<string> {
  return new SignJWT({ st: flow.state, n: flow.nonce, v: flow.verifier, d: flow.door, nx: flow.next })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(FLOW_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${GOOGLE_FLOW_MINUTES}m`)
    .sign(authKey());
}

export async function openFlow(token: string | undefined): Promise<Flow | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authKey(), { algorithms: ["HS256"], audience: FLOW_AUDIENCE });
    const { st, n, v, d, nx } = payload;
    if (typeof st !== "string" || typeof n !== "string" || typeof v !== "string") return null;
    if (d !== "client" && d !== "provider") return null;
    return { state: st, nonce: n, verifier: v, door: d, next: typeof nx === "string" ? safeNext(nx) : null };
  } catch {
    return null;
  }
}

/** Constant-time string comparison (state and nonce). */
export function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---- talking to Google --------------------------------------------------------------------------------------------

export function authUrl(flow: Flow): string {
  const config = googleConfig();
  if (!config) throw new GoogleAuthError("not_configured");
  const query = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: createHash("sha256").update(flow.verifier).digest("base64url"),
    code_challenge_method: "S256",
    // Always show Google's account chooser, so a person on a shared or multi-account browser picks their OWN account
    // instead of being signed straight in as whichever account Google remembered last.
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
}

/** Trades the one-time code for an ID token, server to server. Nothing Google sends back is ever logged. */
export async function exchangeCode(code: string, verifier: string): Promise<string> {
  const config = googleConfig();
  if (!config) throw new GoogleAuthError("not_configured");
  let res: Response;
  try {
    res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new GoogleAuthError("exchange");
  }
  if (!res.ok) {
    console.error("Google token exchange refused, status", res.status);
    throw new GoogleAuthError("exchange");
  }
  const body = (await res.json().catch(() => null)) as { id_token?: unknown } | null;
  if (typeof body?.id_token !== "string") throw new GoogleAuthError("exchange");
  return body.id_token;
}

let remoteKeys: JWTVerifyGetKey | undefined;
/** Google's public signing keys, fetched once and cached by `jose` (it re-fetches when Google rotates them). */
const googleKeys = () => (remoteKeys ??= createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")));

export type GoogleProfile = { sub: string; email: string; name: string };

/**
 * Checks the ID token and returns who it is. Refuses unless ALL of these hold: Google signed it, it was issued by
 * Google, it was issued for THIS app (audience), it has not expired, it carries the nonce of this very sign-in, and
 * Google says the email address is verified. `keys` is only replaced by the unit tests.
 */
export async function verifyIdToken(idToken: string, nonce: string, keys: JWTVerifyGetKey = googleKeys()): Promise<GoogleProfile> {
  const config = googleConfig();
  if (!config) throw new GoogleAuthError("not_configured");
  let claims;
  try {
    ({ payload: claims } = await jwtVerify(idToken, keys, { issuer: ISSUERS, audience: config.clientId, algorithms: ["RS256"] }));
  } catch {
    throw new GoogleAuthError("invalid_token");
  }
  if (typeof claims.nonce !== "string" || !sameSecret(claims.nonce, nonce)) throw new GoogleAuthError("invalid_token");
  const { sub, email, email_verified: verified, name } = claims;
  if (typeof sub !== "string" || !sub || typeof email !== "string" || !email) throw new GoogleAuthError("invalid_token");
  // Google writes this as a boolean; an old format wrote the string "true". Anything else (missing, false) is not verified.
  if (verified !== true && verified !== "true") throw new GoogleAuthError("unverified");
  return { sub, email: email.trim().toLowerCase(), name: typeof name === "string" ? name : "" };
}

// ---- who gets in --------------------------------------------------------------------------------------------------

export type Resolved =
  | { kind: "ok"; user: { id: string; name: string; role: AppRole; tokenVersion: number }; created: boolean }
  | { kind: "wrong_door"; door: Door }
  | { kind: "inactive" }
  | { kind: "admin" }
  | { kind: "two_factor" }
  | { kind: "conflict" }
  | { kind: "limited"; retryAfter: number };

type Existing = { id: string; name: string; role: AppRole; isActive: boolean; googleSub: string | null; tokenVersion: number; totpEnabledAt?: Date | null };
const existingSelect = { id: true, name: true, role: true, isActive: true, googleSub: true, tokenVersion: true, totpEnabledAt: true, emailVerifiedAt: true } as const;

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/** The same checks the password login makes, in the same order of meaning: not an admin, still active, the right door. */
function admit(user: Existing, door: EntryRole): Resolved {
  // An admin signs in with a password only. Google never opens, creates or links an admin account.
  if (user.role === "ADMIN") return { kind: "admin" };
  if (!user.isActive) return { kind: "inactive" };
  // Google must not step around two-step sign-in: such an account signs in with its password and code.
  if (user.totpEnabledAt) return { kind: "two_factor" };
  const other = wrongDoor(door, user.role);
  if (other) return { kind: "wrong_door", door: other };
  return { kind: "ok", user: { id: user.id, name: user.name, role: user.role, tokenVersion: user.tokenVersion }, created: false };
}

/**
 * 1. Already known by their Google id -> sign in.
 * 2. Not known by Google id, but a client or creator account has this (Google-verified) email -> link that account to
 *    this Google id and sign in. (The owner chose this over turning the person away.) If the site never confirmed that
 *    account's email, its password and older sessions end as it is linked.
 * 3. Otherwise make a new account for the door they came through: a client or a creator, never an admin.
 */
export async function resolveGoogleUser(profile: GoogleProfile, door: EntryRole, ip: string): Promise<Resolved> {
  const bySub = await prisma.user.findUnique({ where: { googleSub: profile.sub }, select: existingSelect });
  if (bySub) return admit(bySub, door);

  const byEmail = await prisma.user.findUnique({ where: { email: profile.email }, select: existingSelect });
  if (byEmail) {
    // The account already belongs to a DIFFERENT Google id: never hand it to this one.
    if (byEmail.googleSub && byEmail.googleSub !== profile.sub) return { kind: "conflict" };
    const verdict = admit(byEmail, door);
    if (verdict.kind !== "ok") return verdict;
    // An unconfirmed address says nothing about who made the account: it may be a stranger who signed up with this
    // person's email and a password of their own. Google has now shown who owns the address, so that password and every
    // session made before this moment end here. One update, so the account is never linked with them still working.
    // Two-step sign-in goes with them: `admit` refused an account that had it on, so any found now was switched on in this
    // very moment.
    const takeBack = !byEmail.emailVerifiedAt;
    let linked;
    try {
      linked = await prisma.user.update({
        // The address is part of the condition: an account that has left it since it was read above is not linked.
        where: { id: byEmail.id, email: profile.email },
        data: {
          googleSub: profile.sub,
          ...(takeBack && { passwordHash: null, totpEnabledAt: null, totpSecretEnc: null, tokenVersion: { increment: 1 }, emailVerifiedAt: new Date() }),
        },
        select: { tokenVersion: true },
      });
    } catch (e) {
      if (isUniqueViolation(e)) return { kind: "conflict" };
      throw e;
    }
    await logAudit({ actorId: byEmail.id, action: "USER_GOOGLE_LINKED", entity: "User", entityId: byEmail.id });
    // The new session must carry the version as it is now, or it would be over before it began.
    return { ...verdict, user: { ...verdict.user, tokenVersion: linked.tokenVersion } };
  }

  // Making an account counts against the same hourly limit as registering, but in its own bucket.
  const limitKey = `register:google:ip:${ip}`;
  if (!rateLimit(limitKey, LIMITS.registerPerIp.limit, LIMITS.registerPerIp.windowMs)) {
    return { kind: "limited", retryAfter: retryAfterSeconds(limitKey) };
  }
  // The register form needs 2 to 80 characters; Google's name can be empty, so fall back to the part before the "@".
  const name = (profile.name.trim() || profile.email.split("@")[0]).slice(0, 80).padEnd(2, "_");
  let user;
  try {
    user = await prisma.user.create({
      data: { name, email: profile.email, role: door === "provider" ? "PROVIDER" : "CLIENT", googleSub: profile.sub },
      select: { id: true, name: true, role: true, tokenVersion: true },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { kind: "conflict" }; // two sign-ins for the same new person at the same moment
    throw e;
  }
  await logAudit({ actorId: user.id, action: "USER_REGISTERED", entity: "User", entityId: user.id, meta: { via: "google" } });
  return { kind: "ok", user, created: true };
}

// ---- where to send the person -------------------------------------------------------------------------------------

/** Back to the sign-in page with a reason it shows. `door` (wrong_door only) is the door the account belongs at. */
export function loginProblemPath(door: Door, problem: GoogleProblem, next: string | null, rightDoor?: Door): string {
  return `${authHref("/login", door, next)}&google=${problem}${rightDoor ? `&door=${rightDoor}` : ""}`;
}

/** After a good sign-in. Same places as the password forms: a new creator starts the profile wizard, a new client browses. */
export function landingPath(role: AppRole, created: boolean, next: string | null): string {
  if (created) return role === "PROVIDER" ? "/dashboard/provider/profile/wizard" : next ?? "/search";
  return next ?? ROLE_HOME[role];
}
