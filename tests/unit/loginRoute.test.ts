import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/login/route";
import { seal } from "@/lib/secretBox";
import { newSecret, totpCode } from "@/lib/totp";

// The route's own order of checks is what is tested here, so the database and the session are stood in for.
const { findUnique, startSession, RIGHT, HASH } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  startSession: vi.fn(),
  RIGHT: "right-password",
  HASH: "stand-in-hash",
}));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique } } }));
// Real bcrypt takes a good part of a second per comparison, so each pair of text and hash is worked out only once.
const compared = new Map<string, Promise<boolean>>();
const realCompare = (plain: string, hash: string) => {
  const key = `${plain}\n${hash}`;
  if (!compared.has(key)) compared.set(key, bcrypt.compare(plain, hash));
  return compared.get(key)!;
};
vi.mock("@/lib/auth", () => ({
  // The stand-in hash is "right" only with the stand-in password. Any other hash (the route's dummy one) gets real bcrypt.
  verifyPassword: async (plain: string, hash: string) => (hash === HASH ? plain === RIGHT : realCompare(plain, hash)),
  startSession,
}));

const BAD_LOGIN = "Email yoki parol notoʻgʻri.";

const accounts: Record<string, { id: string; name: string; role: "CLIENT" | "PROVIDER" | "ADMIN"; isActive: boolean; passwordHash: string | null }> = {
  "creator@t.test": { id: "u1", name: "Creator", role: "PROVIDER", isActive: true, passwordHash: HASH },
  "client@t.test": { id: "u2", name: "Client", role: "CLIENT", isActive: true, passwordHash: HASH },
  "admin@t.test": { id: "u3", name: "Admin", role: "ADMIN", isActive: true, passwordHash: HASH },
};

let n = 0;
/** A fresh address per test, so the in-memory limiter never carries one test's failures into the next. */
const freshIp = () => `10.9.${Math.floor(++n / 250)}.${(n % 250) + 1}`;

const signIn = (ip: string, email: string, password: string, role?: string) =>
  POST(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ email, password, ...(role === undefined ? {} : { role }) }),
    }),
  );

// These tests are about the limiter's counters too, so it must be on even if the shell switched it off for e2e.
beforeAll(() => vi.stubEnv("RATE_LIMIT_DISABLED", "false"));
afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  findUnique.mockReset();
  findUnique.mockImplementation(async ({ where }: { where: { email: string } }) => accounts[where.email] ?? null);
  startSession.mockReset();
});

describe("POST /api/auth/login with a door", () => {
  it("answers a wrong password the same at every door, for any account or none", async () => {
    const ip = freshIp();
    const answers: { status: number; body: unknown }[] = [];
    for (const email of ["creator@t.test", "client@t.test", "admin@t.test", "nobody@t.test"]) {
      for (const role of ["client", "provider", "admin", undefined]) {
        const res = await signIn(ip, email, "wrong-password", role);
        answers.push({ status: res.status, body: await res.json() });
        expect(res.headers.get("set-cookie")).toBeNull();
      }
    }
    // 16 attempts from one address stay under every limit (4 per email, 16 in all), so none is a 429.
    expect(answers).toHaveLength(16);
    for (const a of answers) expect(a).toEqual({ status: 401, body: { error: BAD_LOGIN } });
    expect(startSession).not.toHaveBeenCalled();
  });

  it("never signs in to an account that has no password (made or taken back through Google), whatever is typed", async () => {
    const ip = freshIp();
    accounts["google@t.test"] = { id: "u6", name: "Google", role: "CLIENT", isActive: true, passwordHash: null };
    try {
      // The first is the text the route's dummy hash was made from, so the comparison itself succeeds.
      for (const password of ["not-a-real-password", "wrong-password"]) {
        const res = await signIn(ip, "google@t.test", password, "client");
        expect(res.status, password).toBe(401);
        expect(await res.json()).toEqual({ error: BAD_LOGIN });
      }
      expect(startSession).not.toHaveBeenCalled();
    } finally {
      delete accounts["google@t.test"];
    }
  });

  it("refuses a right password at the wrong door with a 403 and starts no session", async () => {
    const ip = freshIp();
    const cases: [string, string, string, string][] = [
      ["creator@t.test", "client", "Bu ijodkor hisobi. Ijodkorlar eshigidan kiring.", "provider"],
      ["client@t.test", "provider", "Bu mijoz hisobi. Mijozlar eshigidan kiring.", "client"],
      ["client@t.test", "admin", "Bu mijoz hisobi. Mijozlar eshigidan kiring.", "client"],
      ["creator@t.test", "admin", "Bu ijodkor hisobi. Ijodkorlar eshigidan kiring.", "provider"],
      ["admin@t.test", "client", "Bu hisob uchun boshqa kirish sahifasi bor.", "admin"],
      ["admin@t.test", "provider", "Bu hisob uchun boshqa kirish sahifasi bor.", "admin"],
    ];
    for (const [email, door, message, own] of cases) {
      const res = await signIn(ip, email, RIGHT, door);
      expect(res.status, `${email} at ${door}`).toBe(403);
      expect(await res.json()).toEqual({ error: message, details: { code: "WRONG_DOOR", door: own } });
      expect(res.headers.get("set-cookie")).toBeNull();
    }
    expect(startSession).not.toHaveBeenCalled();
  });

  it("signs in at the account's own door, and when no door is named", async () => {
    const ip = freshIp();
    for (const [email, door, role] of [
      ["creator@t.test", "provider", "PROVIDER"],
      ["client@t.test", "client", "CLIENT"],
      ["admin@t.test", "admin", "ADMIN"],
      ["creator@t.test", undefined, "PROVIDER"],
    ] as const) {
      startSession.mockClear();
      const res = await signIn(ip, email, RIGHT, door);
      expect(res.status).toBe(200);
      expect((await res.json()).user.role).toBe(role);
      expect(startSession).toHaveBeenCalledTimes(1);
      expect(startSession.mock.calls[0]![0].role).toBe(role);
    }
  });

  it("neither counts a wrong-door answer as a failed attempt nor clears the failures already counted", async () => {
    const ip = freshIp();
    for (let i = 0; i < 4; i++) expect((await signIn(ip, "creator@t.test", "wrong-password", "client")).status).toBe(401);
    // Three wrong-door answers in between: if they counted, the next wrong password would already be blocked...
    for (let i = 0; i < 3; i++) expect((await signIn(ip, "creator@t.test", RIGHT, "client")).status).toBe(403);
    expect((await signIn(ip, "creator@t.test", "wrong-password", "client")).status).toBe(401); // the fifth failure
    // ...and if they had cleared the four, this address would not be blocked after five.
    const blocked = await signIn(ip, "creator@t.test", RIGHT, "provider");
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: BAD_LOGIN });
    expect(startSession).not.toHaveBeenCalled();
  });

  it("tells a deactivated account so only after the right password, door or no door", async () => {
    const ip = freshIp();
    accounts["off@t.test"] = { id: "u4", name: "Off", role: "PROVIDER", isActive: false, passwordHash: HASH };
    try {
      expect((await signIn(ip, "off@t.test", "wrong-password", "client")).status).toBe(401);
      const right = await signIn(ip, "off@t.test", RIGHT, "client");
      expect(right.status).toBe(403);
      const body = await right.json();
      expect(body).toEqual({ error: "Bu hisob faolsizlantirilgan." }); // the deactivated notice, not a door
    } finally {
      delete accounts["off@t.test"];
    }
  });

  it("rejects a door that is not one, the same for an account that exists and one that does not", async () => {
    const ip = freshIp();
    const known = await signIn(ip, "creator@t.test", RIGHT, "CLIENT");
    const unknown = await signIn(ip, "nobody@t.test", RIGHT, "CLIENT");
    expect(known.status).toBe(400);
    expect(unknown.status).toBe(400);
    expect(await known.json()).toEqual(await unknown.json());
    expect(findUnique).not.toHaveBeenCalled(); // refused before any account is looked up
  });
});

describe("POST /api/auth/login with two-step sign-in", () => {
  it("stops code guessing for one account after ten wrong codes, from however many addresses", async () => {
    vi.stubEnv("AUTH_SECRET", "unit-test-secret-of-at-least-32-characters");
    const secret = newSecret();
    accounts["two@t.test"] = {
      id: "u5", name: "Two", role: "CLIENT", isActive: true, passwordHash: HASH,
      totpEnabledAt: new Date(), totpSecretEnc: seal(secret, "totp"),
    } as (typeof accounts)[string];
    const withCode = (code: string) =>
      POST(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": freshIp() },
          body: JSON.stringify({ email: "two@t.test", password: RIGHT, code }),
        }),
      );
    try {
      // Not any of the three codes accepted now.
      const near = [-30_000, 0, 30_000].map((d) => totpCode(secret, Date.now() + d));
      const wrong = ["000000", "111111", "222222", "333333"].find((c) => !near.includes(c))!;
      for (let i = 0; i < 10; i++) expect((await withCode(wrong)).status).toBe(401);
      const blocked = await withCode(totpCode(secret));
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("retry-after")).not.toBeNull();
      expect(startSession).not.toHaveBeenCalled();
    } finally {
      delete accounts["two@t.test"];
    }
  });
});
