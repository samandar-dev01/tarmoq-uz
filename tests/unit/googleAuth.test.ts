import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { SignJWT, generateKeyPair, type KeyLike } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllLimits } from "@/lib/rateLimit";
import { signToken } from "@/lib/token";

// The database and the audit log are stood in for: what is tested is which account the person ends up in.
const db = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: db.findUnique, update: db.update, create: db.create } } }));
vi.mock("@/lib/audit", () => ({ logAudit: db.audit }));

import {
  GoogleAuthError,
  authUrl,
  landingPath,
  loginProblemPath,
  newFlow,
  openFlow,
  resolveGoogleUser,
  sealFlow,
  verifyIdToken,
  type GoogleProfile,
} from "@/lib/googleAuth";

const CLIENT_ID = "client-123.apps.googleusercontent.com";
const NONCE = "nonce-of-this-sign-in";

let privateKey: KeyLike;
let publicKey: KeyLike;
let otherPrivateKey: KeyLike;
const keys = async () => publicKey;

beforeAll(async () => {
  ({ privateKey, publicKey } = await generateKeyPair("RS256"));
  ({ privateKey: otherPrivateKey } = await generateKeyPair("RS256"));
});

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "k3Jx9mQ2vLz8Pw4nTr6YbH1sDf0GcAeU5iVoXyNq7Ms=");
  vi.stubEnv("GOOGLE_CLIENT_ID", CLIENT_ID);
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "a-client-secret");
  vi.stubEnv("APP_URL", "https://tarmoq.test");
  vi.stubEnv("RATE_LIMIT_DISABLED", "false"); // the creation limit is tested, so it must be on
  clearAllLimits();
  for (const fn of Object.values(db)) fn.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

/** An ID token as Google would sign it, with whatever is being tested changed. A value of `undefined` leaves the claim out. */
async function idToken(claims: Record<string, unknown> = {}, opts: { key?: KeyLike; iss?: string; aud?: string; exp?: string | number } = {}) {
  return new SignJWT({ sub: "g-1", email: "Ali@Example.com", email_verified: true, name: "Ali Valiyev", nonce: NONCE, ...claims })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(opts.iss ?? "https://accounts.google.com")
    .setAudience(opts.aud ?? CLIENT_ID)
    .setIssuedAt(typeof opts.exp === "number" ? opts.exp - 7200 : undefined)
    .setExpirationTime(opts.exp ?? "1h")
    .sign(opts.key ?? privateKey);
}

const reason = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof GoogleAuthError ? e.reason : `not a GoogleAuthError: ${String(e)}`;
  }
  return "accepted";
};

describe("verifyIdToken: only a Google account whose email Google calls verified gets in", () => {
  it("accepts a good token and lower-cases the email", async () => {
    expect(await verifyIdToken(await idToken(), NONCE, keys)).toEqual({ sub: "g-1", email: "ali@example.com", name: "Ali Valiyev" });
  });

  it("accepts the other issuer spelling Google uses", async () => {
    await expect(verifyIdToken(await idToken({}, { iss: "accounts.google.com" }), NONCE, keys)).resolves.toMatchObject({ sub: "g-1" });
  });

  it("refuses an email Google says is NOT verified", async () => {
    expect(await reason(verifyIdToken(await idToken({ email_verified: false }), NONCE, keys))).toBe("unverified");
  });

  it("refuses a token with no email_verified claim at all", async () => {
    expect(await reason(verifyIdToken(await idToken({ email_verified: undefined }), NONCE, keys))).toBe("unverified");
  });

  it("does not take a loose truthy value for verified", async () => {
    for (const value of ["yes", 1, "false", null]) {
      expect(await reason(verifyIdToken(await idToken({ email_verified: value }), NONCE, keys))).toBe("unverified");
    }
  });

  it("accepts the old string form of true", async () => {
    await expect(verifyIdToken(await idToken({ email_verified: "true" }), NONCE, keys)).resolves.toMatchObject({ email: "ali@example.com" });
  });

  it("refuses a token made for another app (audience)", async () => {
    expect(await reason(verifyIdToken(await idToken({}, { aud: "someone-elses-app" }), NONCE, keys))).toBe("invalid_token");
  });

  it("refuses a token not issued by Google", async () => {
    expect(await reason(verifyIdToken(await idToken({}, { iss: "https://evil.example" }), NONCE, keys))).toBe("invalid_token");
  });

  it("refuses an expired token", async () => {
    const hourAgo = Math.floor(Date.now() / 1000) - 3600;
    expect(await reason(verifyIdToken(await idToken({}, { exp: hourAgo }), NONCE, keys))).toBe("invalid_token");
  });

  it("refuses a token signed with a key that is not Google's", async () => {
    expect(await reason(verifyIdToken(await idToken({}, { key: otherPrivateKey }), NONCE, keys))).toBe("invalid_token");
  });

  it("refuses a token carrying another sign-in's nonce, or none", async () => {
    expect(await reason(verifyIdToken(await idToken({ nonce: "a-replayed-nonce" }), NONCE, keys))).toBe("invalid_token");
    expect(await reason(verifyIdToken(await idToken({ nonce: undefined }), NONCE, keys))).toBe("invalid_token");
  });

  it("refuses a token with no subject or no email", async () => {
    expect(await reason(verifyIdToken(await idToken({ sub: undefined }), NONCE, keys))).toBe("invalid_token");
    expect(await reason(verifyIdToken(await idToken({ email: undefined }), NONCE, keys))).toBe("invalid_token");
  });

  it("refuses garbage", async () => {
    expect(await reason(verifyIdToken("not.a.token", NONCE, keys))).toBe("invalid_token");
  });

  it("refuses everything while the Google keys are not set", async () => {
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    expect(await reason(verifyIdToken(await idToken(), NONCE, keys))).toBe("not_configured");
  });
});

describe("authUrl: the person chooses their own Google account", () => {
  it("always asks Google for its account chooser, and uses PKCE, state and nonce", () => {
    const flow = newFlow("provider", "/dashboard/provider");
    const url = new URL(authUrl(flow));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const q = url.searchParams;
    expect(q.get("prompt")).toBe("select_account");
    expect(q.get("client_id")).toBe(CLIENT_ID);
    expect(q.get("redirect_uri")).toBe("https://tarmoq.test/api/auth/google/callback");
    expect(q.get("response_type")).toBe("code");
    expect(q.get("scope")).toBe("openid email profile");
    expect(q.get("state")).toBe(flow.state);
    expect(q.get("nonce")).toBe(flow.nonce);
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("code_challenge")).toBe(createHash("sha256").update(flow.verifier).digest("base64url"));
    expect(url.toString()).not.toContain(flow.verifier); // the verifier itself never goes to Google until the code is traded
    expect(url.toString()).not.toContain("a-client-secret");
  });

  it("makes a new state, nonce and verifier every time", () => {
    const a = newFlow("client", null);
    const b = newFlow("client", null);
    expect(new Set([a.state, a.nonce, a.verifier, b.state, b.nonce, b.verifier]).size).toBe(6);
    expect(a.verifier.length).toBeGreaterThanOrEqual(43);
    expect(a.verifier.length).toBeLessThanOrEqual(128);
  });

  it("will not build the address without the Google keys", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    expect(() => authUrl(newFlow("client", null))).toThrow(GoogleAuthError);
  });
});

describe("the sealed flow cookie", () => {
  it("comes back as it went in, and keeps only a safe `next`", async () => {
    const flow = newFlow("provider", "/orders/42");
    expect(await openFlow(await sealFlow(flow))).toEqual(flow);
    expect(newFlow("client", "//evil.example").next).toBeNull();
    expect(newFlow("client", "https://evil.example").next).toBeNull();
  });

  it("is refused when it is missing, altered, or signed for something else", async () => {
    expect(await openFlow(undefined)).toBeNull();
    expect(await openFlow("")).toBeNull();
    const sealed = await sealFlow(newFlow("client", null));
    expect(await openFlow(`${sealed.slice(0, -3)}abc`)).toBeNull();
    // A real session cookie is signed with the same key but is not a flow.
    expect(await openFlow(await signToken({ sub: "u1", role: "CLIENT", name: "A" }))).toBeNull();
  });
});

describe("resolveGoogleUser: who ends up signed in", () => {
  const profile: GoogleProfile = { sub: "g-1", email: "ali@example.com", name: "Ali Valiyev" };
  type Row = { id: string; name: string; role: "CLIENT" | "PROVIDER" | "ADMIN"; isActive: boolean; googleSub: string | null; email: string };
  const row = (over: Partial<Row> = {}): Row => ({ id: "u1", name: "Ali", role: "CLIENT", isActive: true, googleSub: null, email: "ali@example.com", ...over });
  /** The database holds these rows; a lookup by googleSub or by email finds the first match. */
  const holds = (...rows: Row[]) =>
    db.findUnique.mockImplementation(async ({ where }: { where: { googleSub?: string; email?: string } }) =>
      rows.find((r) => (where.googleSub !== undefined ? r.googleSub === where.googleSub : r.email === where.email)) ?? null,
    );

  it("signs in a person already known by their Google id", async () => {
    holds(row({ googleSub: "g-1" }));
    expect(await resolveGoogleUser(profile, "client", "1.1.1.1")).toEqual({ kind: "ok", user: { id: "u1", name: "Ali", role: "CLIENT" }, created: false });
    expect(db.update).not.toHaveBeenCalled();
    expect(db.create).not.toHaveBeenCalled();
  });

  it("LINKS a client or creator account that has the same verified email, and signs in", async () => {
    holds(row());
    expect(await resolveGoogleUser(profile, "client", "1.1.1.1")).toEqual({ kind: "ok", user: { id: "u1", name: "Ali", role: "CLIENT" }, created: false });
    expect(db.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { googleSub: "g-1" } });
    expect(db.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "USER_GOOGLE_LINKED", entityId: "u1" }));
    expect(db.create).not.toHaveBeenCalled();

    holds(row({ id: "u2", role: "PROVIDER" }));
    expect((await resolveGoogleUser(profile, "provider", "1.1.1.1")).kind).toBe("ok");
    expect(db.update).toHaveBeenLastCalledWith({ where: { id: "u2" }, data: { googleSub: "g-1" } });
  });

  it("never opens, makes or links an ADMIN through Google", async () => {
    holds(row({ id: "a1", role: "ADMIN" }));
    for (const door of ["client", "provider"] as const) expect((await resolveGoogleUser(profile, door, "1.1.1.1")).kind).toBe("admin");
    holds(row({ id: "a1", role: "ADMIN", googleSub: "g-1" }));
    expect((await resolveGoogleUser(profile, "client", "1.1.1.1")).kind).toBe("admin");
    expect(db.update).not.toHaveBeenCalled();
    expect(db.create).not.toHaveBeenCalled();
  });

  it("keeps the door rule of the password form: a creator at the client door is sent to their own door, and nothing is linked", async () => {
    holds(row({ role: "PROVIDER" }));
    expect(await resolveGoogleUser(profile, "client", "1.1.1.1")).toEqual({ kind: "wrong_door", door: "provider" });
    holds(row({ role: "CLIENT" }));
    expect(await resolveGoogleUser(profile, "provider", "1.1.1.1")).toEqual({ kind: "wrong_door", door: "client" });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("refuses a deactivated account, known by Google id or by email, and links nothing", async () => {
    holds(row({ isActive: false, googleSub: "g-1" }));
    expect((await resolveGoogleUser(profile, "client", "1.1.1.1")).kind).toBe("inactive");
    holds(row({ isActive: false }));
    expect((await resolveGoogleUser(profile, "client", "1.1.1.1")).kind).toBe("inactive");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("never hands an account that belongs to a DIFFERENT Google id to this one", async () => {
    holds(row({ googleSub: "someone-else" }));
    expect((await resolveGoogleUser(profile, "client", "1.1.1.1")).kind).toBe("conflict");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("answers a conflict when the link loses a race on the unique Google id", async () => {
    holds(row());
    db.update.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "5.22.0" }));
    expect((await resolveGoogleUser(profile, "client", "1.1.1.1")).kind).toBe("conflict");
  });

  it("makes a new CLIENT at the client door and a new CREATOR at the creator door, with no password and no phone", async () => {
    holds();
    db.create.mockImplementation(async ({ data }: { data: { name: string; role: "CLIENT" | "PROVIDER" } }) => ({ id: "new1", name: data.name, role: data.role, tokenVersion: 0 }));
    expect(await resolveGoogleUser(profile, "client", "2.2.2.2")).toEqual({ kind: "ok", user: { id: "new1", name: "Ali Valiyev", role: "CLIENT", tokenVersion: 0 }, created: true });
    expect(db.create).toHaveBeenLastCalledWith({
      data: { name: "Ali Valiyev", email: "ali@example.com", role: "CLIENT", googleSub: "g-1" },
      select: { id: true, name: true, role: true, tokenVersion: true },
    });
    expect(db.audit).toHaveBeenLastCalledWith(expect.objectContaining({ action: "USER_REGISTERED", meta: { via: "google" } }));

    const created = await resolveGoogleUser(profile, "provider", "2.2.2.2");
    expect(created).toMatchObject({ kind: "ok", created: true, user: { role: "PROVIDER" } });
    const data = db.create.mock.calls.at(-1)![0].data;
    expect(data).not.toHaveProperty("passwordHash");
    expect(data).not.toHaveProperty("phone");
    expect(data.role).not.toBe("ADMIN");
  });

  it("names a new account from the email when Google gives no usable name, and keeps the name within 2 to 80 characters", async () => {
    holds();
    db.create.mockImplementation(async ({ data }: { data: { name: string; role: string } }) => ({ id: "n", name: data.name, role: data.role }));
    await resolveGoogleUser({ ...profile, name: "  " }, "client", "3.3.3.3");
    expect(db.create.mock.calls.at(-1)![0].data.name).toBe("ali");
    await resolveGoogleUser({ ...profile, name: "x".repeat(200) }, "client", "3.3.3.3");
    expect(db.create.mock.calls.at(-1)![0].data.name).toHaveLength(80);
    await resolveGoogleUser({ ...profile, name: "", email: "a@example.com" }, "client", "3.3.3.3");
    expect(db.create.mock.calls.at(-1)![0].data.name).toBe("a_");
  });

  it("limits how many accounts one address can make through Google (5 an hour), but not signing in", async () => {
    holds();
    db.create.mockImplementation(async ({ data }: { data: { name: string; role: string } }) => ({ id: "n", name: data.name, role: data.role }));
    for (let i = 0; i < 5; i++) expect((await resolveGoogleUser({ ...profile, sub: `s${i}`, email: `p${i}@example.com` }, "client", "4.4.4.4")).kind).toBe("ok");
    const sixth = await resolveGoogleUser({ ...profile, sub: "s6", email: "p6@example.com" }, "client", "4.4.4.4");
    expect(sixth).toMatchObject({ kind: "limited" });
    expect(db.create).toHaveBeenCalledTimes(5);
    // The same address can still sign in an account that exists.
    holds(row({ googleSub: "g-1" }));
    expect((await resolveGoogleUser(profile, "client", "4.4.4.4")).kind).toBe("ok");
  });

  it("answers a conflict when two sign-ins make the same new person at once", async () => {
    holds();
    db.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "5.22.0" }));
    expect((await resolveGoogleUser(profile, "client", "5.5.5.5")).kind).toBe("conflict");
  });

  it("lets any other database error through, so the callback can say it failed", async () => {
    db.findUnique.mockRejectedValue(new Error("database is down"));
    await expect(resolveGoogleUser(profile, "client", "6.6.6.6")).rejects.toThrow("database is down");
  });
});

describe("where the person is sent", () => {
  it("sends a problem back to the door they came from, keeping next, and names the right door for a wrong one", () => {
    expect(loginProblemPath("client", "cancelled", null)).toBe("/login?role=client&google=cancelled");
    expect(loginProblemPath("provider", "failed", "/orders/7")).toBe("/login?role=provider&next=%2Forders%2F7&google=failed");
    expect(loginProblemPath("client", "wrong_door", null, "provider")).toBe("/login?role=client&google=wrong_door&door=provider");
  });

  it("lands a new creator in the profile wizard, a new client where the form sends them, a returning person at their home", () => {
    expect(landingPath("PROVIDER", true, "/x")).toBe("/dashboard/provider/profile/wizard");
    expect(landingPath("CLIENT", true, null)).toBe("/search");
    expect(landingPath("CLIENT", true, "/orders/new")).toBe("/orders/new");
    expect(landingPath("CLIENT", false, null)).toBe("/dashboard/client");
    expect(landingPath("PROVIDER", false, null)).toBe("/dashboard/provider");
    expect(landingPath("CLIENT", false, "/messages")).toBe("/messages");
  });
});
