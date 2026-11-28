import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as changeEmail } from "@/app/api/account/email/route";
import { POST as changePassword } from "@/app/api/account/password/route";
import { POST as signOutEverywhere } from "@/app/api/account/sessions/revoke/route";
import { POST as twoFactor } from "@/app/api/account/two-factor/route";
import { POST as confirmEmail } from "@/app/api/auth/verify-email/route";
import { createToken } from "@/lib/authTokens";
import { resolveGoogleUser } from "@/lib/googleAuth";
import { clearAllLimits } from "@/lib/rateLimit";
import { seal } from "@/lib/secretBox";
import { signToken, verifyToken } from "@/lib/token";
import { newSecret, totpCode } from "@/lib/totp";

// Someone may have made an account with another person's email. These are the two ways they could have kept it after the
// owner of the address arrived: a request still being worked on at that moment, and a confirmation link pressed by the owner.
// The real routes and the real Google linking run here; the database, the cookies and bcrypt are stood in for.

type Row = Record<string, any> & { id: string; email: string; tokenVersion: number };

const store = vi.hoisted(() => ({
  users: [] as any[],
  tokens: [] as any[],
  cookies: new Map<string, string>(),
  /** Something another request commits after this one passed its session check and before it writes. Runs once. */
  meanwhile: null as null | (() => Promise<unknown>),
}));

vi.mock("@/lib/db", () => {
  const arrive = async () => {
    const event = store.meanwhile;
    store.meanwhile = null;
    await event?.();
  };
  const matching = (rows: any[], where: Record<string, unknown>) => rows.find((r) => Object.entries(where).every(([k, v]) => r[k] === v));
  const user = {
    findUnique: async ({ where }: any) => {
      const row = matching(store.users, where);
      return row ? { ...row } : null;
    },
    findUniqueOrThrow: async ({ where }: any) => ({ ...matching(store.users, where) }),
    update: async ({ where, data }: any) => {
      await arrive();
      const row = matching(store.users, where);
      if (!row) throw new Error("no such row");
      const { tokenVersion, ...fields } = data;
      Object.assign(row, fields);
      if (tokenVersion) row.tokenVersion += tokenVersion.increment;
      return { ...row };
    },
  };
  const unused = (where: any) => (t: any) =>
    t.userId === where.userId && !t.usedAt && (typeof where.kind === "string" ? t.kind === where.kind : where.kind.in.includes(t.kind));
  const authToken = {
    deleteMany: async ({ where }: any) => void (store.tokens = store.tokens.filter((t) => !unused(where)(t))),
    create: async ({ data }: any) => void store.tokens.push({ usedAt: null, ...data }),
    updateMany: async ({ where, data }: any) => {
      const found = store.tokens.filter((t) => t.tokenHash === where.tokenHash && t.kind === where.kind && !t.usedAt && t.expiresAt > where.expiresAt.gt);
      for (const t of found) Object.assign(t, data);
      return { count: found.length };
    },
    findUnique: async ({ where }: any) => matching(store.tokens, where) ?? null,
  };
  const prisma: any = {
    user,
    authToken,
    // The two row locks: a row comes back only while the account still has that session version, or that address.
    $queryRaw: async (sql: TemplateStringsArray, id: string, value: unknown) => {
      const text = sql.join("?");
      const column = text.includes('"tokenVersion"') ? "tokenVersion" : text.includes('"email"') ? "email" : null;
      if (!column) throw new Error(`unexpected query: ${text}`);
      return matching(store.users, { id, [column]: value }) ? [{}] : [];
    },
    $transaction: async (work: any) => {
      if (Array.isArray(work)) return Promise.all(work);
      await arrive();
      const before = structuredClone({ users: store.users, tokens: store.tokens });
      try {
        return await work(prisma);
      } catch (e) {
        // Rolled back, row by row, so a test's reference to a row stays good.
        store.users.forEach((row, i) => Object.assign(row, before.users[i]));
        store.tokens = before.tokens;
        throw e;
      }
    },
  };
  return { prisma };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (store.cookies.has(name) ? { name, value: store.cookies.get(name) } : undefined),
    set: (name: string, value: string) => void store.cookies.set(name, value),
    delete: (name: string) => void store.cookies.delete(name),
  }),
}));
vi.mock("bcryptjs", () => ({ default: { compare: async (plain: string, hash: string) => hash === `hash:${plain}`, hash: async (plain: string) => `hash:${plain}` } }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("@/lib/mail", () => ({ mailEnabled: () => false, sendMail: async () => true }));

const EMAIL = "owner@example.com";

function account(over: Record<string, unknown> = {}): Row {
  const row = {
    id: "u1", email: EMAIL, name: "Stranger", phone: null, role: "CLIENT", isActive: true, avatarUpdatedAt: null,
    lastSeenAt: new Date(), tokenVersion: 0, passwordHash: "hash:stranger-pass-1", googleSub: null,
    emailVerifiedAt: null, totpSecretEnc: null, totpEnabledAt: null, ...over,
  } as Row;
  store.users.push(row);
  return row;
}

async function signIn(row: Row) {
  const cookie = await signToken({ sub: row.id, role: "CLIENT", name: row.name, tv: row.tokenVersion });
  store.cookies.set("session", cookie);
  return cookie;
}

const post = (route: (req: Request) => Promise<Response>, body: unknown = {}) =>
  route(new Request("http://localhost/api/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

const ownerArrivesThroughGoogle = () => resolveGoogleUser({ sub: "g-owner", email: EMAIL, name: "Owner" }, "client", "1.1.1.1");

const SECRET = newSecret();
const REQUESTS: [string, Record<string, unknown>, () => Promise<Response>, Record<string, unknown>][] = [
  // name, what the account needs first, the request, what it changes when nothing happens meanwhile
  [
    "a password change",
    {},
    () => post(changePassword, { currentPassword: "stranger-pass-1", newPassword: "stranger-pass-2", confirmPassword: "stranger-pass-2" }),
    { passwordHash: "hash:stranger-pass-2", tokenVersion: 1 },
  ],
  ["sign out everywhere", {}, () => post(signOutEverywhere), { tokenVersion: 1 }],
  [
    "an email change",
    {},
    () => post(changeEmail, { email: "stranger@example.com", currentPassword: "stranger-pass-1" }),
    { email: "stranger@example.com" },
  ],
  ["setting up two-step sign-in", {}, () => post(twoFactor, { action: "setup", currentPassword: "stranger-pass-1" }), { totpSecretEnc: expect.any(String) }],
  ["turning two-step sign-in on", { totpSecretEnc: "SEALED" }, () => post(twoFactor, { action: "enable", code: totpCode(SECRET) }), { totpEnabledAt: expect.any(Date) }],
];

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "k3Jx9mQ2vLz8Pw4nTr6YbH1sDf0GcAeU5iVoXyNq7Ms=");
  store.users = [];
  store.tokens = [];
  store.cookies.clear();
  store.meanwhile = null;
  clearAllLimits();
});

const prepared = (over: Record<string, unknown>) => account(over.totpSecretEnc ? { totpSecretEnc: seal(SECRET, "totp") } : over);

describe("a request still being worked on when the owner of the address arrives through Google", () => {
  it.each(REQUESTS)("%s is refused and changes nothing", async (_name, needs, send) => {
    const row = prepared(needs);
    const cookie = await signIn(row);
    let afterLinking: Row | undefined;
    store.meanwhile = async () => {
      await ownerArrivesThroughGoogle();
      afterLinking = { ...row };
    };

    const res = await send();

    expect(res.status).toBe(401);
    expect(row).toEqual(afterLinking);
    expect(row).toMatchObject({ passwordHash: null, googleSub: "g-owner", email: EMAIL, tokenVersion: 1, totpEnabledAt: null });
    expect(store.cookies.get("session")).toBe(cookie); // no new session was handed out
  });

  it.each(REQUESTS)("%s works as before when nothing happens meanwhile", async (_name, needs, send, changes) => {
    const row = prepared(needs);
    await signIn(row);
    const res = await send();
    expect(res.status).toBe(200);
    expect(row).toMatchObject(changes);
    // Whoever made the change stays signed in.
    expect((await verifyToken(store.cookies.get("session")!))!.tv).toBe(row.tokenVersion);
  });
});

describe("a stranger's request that finishes while the account is being linked", () => {
  it("two-step sign-in switched on in that instant goes too, so the owner is not locked out next time", async () => {
    const row = account();
    store.meanwhile = async () => void Object.assign(row, { totpSecretEnc: seal(SECRET, "totp"), totpEnabledAt: new Date() });
    expect((await ownerArrivesThroughGoogle()).kind).toBe("ok");
    expect(row).toMatchObject({ passwordHash: null, totpSecretEnc: null, totpEnabledAt: null });
    expect((await ownerArrivesThroughGoogle()).kind).toBe("ok");
  });

  it("an email address changed in that instant leaves the account unlinked", async () => {
    const row = account();
    store.meanwhile = async () => void (row.email = "stranger@example.com");
    await expect(ownerArrivesThroughGoogle()).rejects.toThrow();
    expect(row).toMatchObject({ googleSub: null, emailVerifiedAt: null });
  });
});

describe("confirming an email", () => {
  const confirm = (token: string) => post(confirmEmail, { token });

  it("is refused without signing in: reading the email is not enough, and the link is not used up", async () => {
    const row = account();
    const token = (await createToken(row.id, "verify", EMAIL))!;
    expect((await confirm(token)).status).toBe(401);
    expect(row.emailVerifiedAt).toBeNull();
    expect(store.tokens).toMatchObject([{ usedAt: null }]);
    // So when the owner then arrives through Google, the stranger's password still goes.
    await ownerArrivesThroughGoogle();
    expect(row.passwordHash).toBeNull();
  });

  it("is refused to someone signed in to a different account, and the link stays good for its own", async () => {
    const row = account();
    const other = account({ id: "u2", email: "other@example.com" });
    const token = (await createToken(row.id, "verify", EMAIL))!;

    await signIn(other);
    expect((await confirm(token)).status).toBe(403);
    expect(row.emailVerifiedAt).toBeNull();
    expect(other.emailVerifiedAt).toBeNull();
    expect(store.tokens).toMatchObject([{ usedAt: null }]);

    await signIn(row);
    expect((await confirm(token)).status).toBe(200);
    expect(row.emailVerifiedAt).toBeInstanceOf(Date);
  });
});

describe("a link sent by email", () => {
  it.each(["verify", "reset"] as const)("(%s) is only made while the account still has the address it goes to", async (kind) => {
    const row = account({ email: "new@example.com" });
    // The address was changed after the request for the link read the old one.
    expect(await createToken(row.id, kind, "old@example.com")).toBeNull();
    expect(store.tokens).toHaveLength(0);

    expect(await createToken(row.id, kind, "new@example.com")).toEqual(expect.any(String));
    expect(store.tokens).toMatchObject([{ userId: row.id, kind, usedAt: null }]);
  });
});
