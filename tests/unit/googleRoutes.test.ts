import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the request's cookie jar: what the route sets is recorded, what it reads is what the test put there.
const jar = vi.hoisted(() => ({ values: new Map<string, string>(), sets: [] as { name: string; value: string; options: Record<string, unknown> }[] }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name)! } : undefined),
    set: (name: string, value: string, options: Record<string, unknown> = {}) => {
      jar.sets.push({ name, value, options });
      if (options.maxAge === 0) jar.values.delete(name);
      else jar.values.set(name, value);
    },
  }),
}));

const session = vi.hoisted(() => ({ startSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ startSession: session.startSession }));

// Google itself and the database are stood in for; the flow cookie, the state check and the redirects are the real ones.
const google = vi.hoisted(() => ({ exchangeCode: vi.fn(), verifyIdToken: vi.fn(), resolveGoogleUser: vi.fn() }));
vi.mock("@/lib/googleAuth", async (original) => ({ ...(await original<typeof import("@/lib/googleAuth")>()), ...google }));

import { GET as callback } from "@/app/api/auth/google/callback/route";
import { GET as start } from "@/app/api/auth/google/start/route";
import { GOOGLE_FLOW_COOKIE, GoogleAuthError, newFlow, sealFlow, type Flow } from "@/lib/googleAuth";

const HOME = "https://tarmoq.test";
const profile = { sub: "g-1", email: "ali@example.com", name: "Ali" };

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "k3Jx9mQ2vLz8Pw4nTr6YbH1sDf0GcAeU5iVoXyNq7Ms=");
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-123.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "a-client-secret");
  vi.stubEnv("APP_URL", HOME);
  jar.values.clear();
  jar.sets.length = 0;
  session.startSession.mockReset();
  for (const fn of Object.values(google)) fn.mockReset();
  google.exchangeCode.mockResolvedValue("an.id.token");
  google.verifyIdToken.mockResolvedValue(profile);
});
afterEach(() => vi.unstubAllEnvs());

const startReq = (qs: string) => start(new Request(`${HOME}/api/auth/google/start?${qs}`));
const callbackReq = (qs: string) => callback(new Request(`${HOME}/api/auth/google/callback?${qs}`));
const where = (res: Response) => res.headers.get("location");

/** Puts a real, sealed flow cookie in the jar, as /start would have, and returns the flow. */
async function inFlow(door: "client" | "provider" = "client", next: string | null = null): Promise<Flow> {
  const flow = newFlow(door, next);
  jar.values.set(GOOGLE_FLOW_COOKIE, await sealFlow(flow));
  return flow;
}

describe("GET /api/auth/google/start", () => {
  it("sends the person to Google's account chooser and seals the flow in a short, httpOnly cookie", async () => {
    const res = await startReq("role=provider&next=/orders/9");
    expect(res.status).toBe(302);
    const url = new URL(where(res)!);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.get("redirect_uri")).toBe(`${HOME}/api/auth/google/callback`);

    const cookie = jar.sets.find((s) => s.name === GOOGLE_FLOW_COOKIE)!;
    expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/api/auth/google", maxAge: 600 });
    // What went to Google is the same flow that is in the cookie.
    const { openFlow } = await import("@/lib/googleAuth");
    expect(await openFlow(cookie.value)).toMatchObject({ state: url.searchParams.get("state"), nonce: url.searchParams.get("nonce"), door: "provider", next: "/orders/9" });
  });

  it("drops a `next` that leaves the site", async () => {
    await startReq("role=client&next=//evil.example/x");
    const { openFlow } = await import("@/lib/googleAuth");
    expect((await openFlow(jar.sets.find((s) => s.name === GOOGLE_FLOW_COOKIE)!.value))!.next).toBeNull();
  });

  it("takes anything but the creator door for the client door", async () => {
    await startReq("role=nonsense");
    const { openFlow } = await import("@/lib/googleAuth");
    expect((await openFlow(jar.sets[0].value))!.door).toBe("client");
  });

  it("does not offer Google at the admin door", async () => {
    const res = await startReq("role=admin");
    expect(where(res)).toBe(`${HOME}/login?role=admin&google=admin`);
    expect(jar.sets).toHaveLength(0);
  });

  it("comes back to the sign-in page, with nothing set, while the Google keys are not set", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    const res = await startReq("role=provider");
    expect(where(res)).toBe(`${HOME}/login?role=provider&google=failed`);
    expect(jar.sets).toHaveLength(0);
  });
});

describe("GET /api/auth/google/callback", () => {
  it("signs a returning person in and sends them home", async () => {
    const flow = await inFlow("client");
    google.resolveGoogleUser.mockResolvedValue({ kind: "ok", user: { id: "u1", name: "Ali", role: "CLIENT" }, created: false });
    const res = await callbackReq(`code=abc&state=${flow.state}`);
    expect(where(res)).toBe(`${HOME}/dashboard/client`);
    expect(session.startSession).toHaveBeenCalledWith({ id: "u1", name: "Ali", role: "CLIENT" });
    // The trade for the token used this sign-in's own verifier and nonce, and the account was looked for at this door.
    expect(google.exchangeCode).toHaveBeenCalledWith("abc", flow.verifier);
    expect(google.verifyIdToken).toHaveBeenCalledWith("an.id.token", flow.nonce);
    expect(google.resolveGoogleUser).toHaveBeenCalledWith(profile, "client", expect.any(String));
  });

  it("starts a new creator in the profile wizard, and a new client where `next` points", async () => {
    let flow = await inFlow("provider", "/x");
    google.resolveGoogleUser.mockResolvedValue({ kind: "ok", user: { id: "n1", name: "Ali", role: "PROVIDER" }, created: true });
    expect(where(await callbackReq(`code=abc&state=${flow.state}`))).toBe(`${HOME}/dashboard/provider/profile/wizard`);

    flow = await inFlow("client", "/orders/new");
    google.resolveGoogleUser.mockResolvedValue({ kind: "ok", user: { id: "n2", name: "Ali", role: "CLIENT" }, created: true });
    expect(where(await callbackReq(`code=abc&state=${flow.state}`))).toBe(`${HOME}/orders/new`);
  });

  it("uses the flow cookie once: it is cleared whatever the outcome", async () => {
    const flow = await inFlow();
    google.resolveGoogleUser.mockResolvedValue({ kind: "ok", user: { id: "u1", name: "Ali", role: "CLIENT" }, created: false });
    await callbackReq(`code=abc&state=${flow.state}`);
    expect(jar.sets[0]).toMatchObject({ name: GOOGLE_FLOW_COOKIE, value: "", options: { path: "/api/auth/google", maxAge: 0 } });
    expect(jar.values.has(GOOGLE_FLOW_COOKIE)).toBe(false);
  });

  it("starts no session when the flow cookie is missing, forged or old", async () => {
    expect(where(await callbackReq("code=abc&state=whatever"))).toBe(`${HOME}/login?role=client&google=failed`);
    jar.values.set(GOOGLE_FLOW_COOKIE, "forged.cookie.value");
    expect(where(await callbackReq("code=abc&state=whatever"))).toBe(`${HOME}/login?role=client&google=failed`);
    expect(session.startSession).not.toHaveBeenCalled();
    expect(google.exchangeCode).not.toHaveBeenCalled();
  });

  it("starts no session, and never trades the code, when the state does not match (a forged return)", async () => {
    await inFlow();
    expect(where(await callbackReq("code=abc&state=attacker-chosen"))).toBe(`${HOME}/login?role=client&google=failed`);
    expect(where(await callbackReq("code=abc"))).toBe(`${HOME}/login?role=client&google=failed`); // (the cookie is gone by now; same answer)
    expect(session.startSession).not.toHaveBeenCalled();
    expect(google.exchangeCode).not.toHaveBeenCalled();
  });

  it("goes back to the same door, keeping `next`, when the person presses Cancel on Google's screen", async () => {
    await inFlow("provider", "/orders/5");
    const res = await callbackReq("error=access_denied");
    expect(where(res)).toBe(`${HOME}/login?role=provider&next=%2Forders%2F5&google=cancelled`);
    expect(session.startSession).not.toHaveBeenCalled();
  });

  it("treats any other error from Google as a failure", async () => {
    await inFlow();
    expect(where(await callbackReq("error=server_error"))).toBe(`${HOME}/login?role=client&google=failed`);
  });

  it("starts no session for an email Google does not call verified, and says why", async () => {
    const flow = await inFlow("client");
    google.verifyIdToken.mockRejectedValue(new GoogleAuthError("unverified"));
    expect(where(await callbackReq(`code=abc&state=${flow.state}`))).toBe(`${HOME}/login?role=client&google=unverified`);
    expect(google.resolveGoogleUser).not.toHaveBeenCalled();
    expect(session.startSession).not.toHaveBeenCalled();
  });

  it("starts no session when Google refuses the code or the token is bad", async () => {
    let flow = await inFlow();
    google.exchangeCode.mockRejectedValue(new GoogleAuthError("exchange"));
    expect(where(await callbackReq(`code=abc&state=${flow.state}`))).toBe(`${HOME}/login?role=client&google=failed`);
    flow = await inFlow();
    google.exchangeCode.mockResolvedValue("x.y.z");
    google.verifyIdToken.mockRejectedValue(new GoogleAuthError("invalid_token"));
    expect(where(await callbackReq(`code=abc&state=${flow.state}`))).toBe(`${HOME}/login?role=client&google=failed`);
    expect(session.startSession).not.toHaveBeenCalled();
  });

  it("sends a person with the other kind of account to their own door", async () => {
    const flow = await inFlow("client");
    google.resolveGoogleUser.mockResolvedValue({ kind: "wrong_door", door: "provider" });
    expect(where(await callbackReq(`code=abc&state=${flow.state}`))).toBe(`${HOME}/login?role=client&google=wrong_door&door=provider`);
    expect(session.startSession).not.toHaveBeenCalled();
  });

  it("starts no session for an admin, a deactivated account, a conflict or a too-busy address", async () => {
    const outcomes: [Record<string, unknown>, string][] = [
      [{ kind: "admin" }, "admin"],
      [{ kind: "inactive" }, "inactive"],
      [{ kind: "conflict" }, "failed"],
      [{ kind: "limited", retryAfter: 60 }, "limited"],
    ];
    for (const [result, problem] of outcomes) {
      const flow = await inFlow("client");
      google.resolveGoogleUser.mockResolvedValue(result);
      expect(where(await callbackReq(`code=abc&state=${flow.state}`))).toBe(`${HOME}/login?role=client&google=${problem}`);
    }
    expect(session.startSession).not.toHaveBeenCalled();
  });

  it("says it failed, rather than crashing, when the database is down", async () => {
    const flow = await inFlow();
    google.resolveGoogleUser.mockRejectedValue(new Error("database is down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(where(await callbackReq(`code=abc&state=${flow.state}`))).toBe(`${HOME}/login?role=client&google=failed`);
    expect(session.startSession).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
