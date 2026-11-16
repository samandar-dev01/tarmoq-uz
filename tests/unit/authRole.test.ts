import { describe, it, expect } from "vitest";
import { authHref, doorForRole, doorForRoles, loginPathFor, parseDoor, parseEntryRole, wrongDoor, type Door } from "@/lib/authRole";
import { safeNext } from "@/lib/safeNext";
import { loginSchema } from "@/lib/validators";

describe("doors and roles", () => {
  it("maps each account role to its one door", () => {
    expect(doorForRole("CLIENT")).toBe("client");
    expect(doorForRole("PROVIDER")).toBe("provider");
    expect(doorForRole("ADMIN")).toBe("admin");
  });

  it("reads a door from the query: unknown, empty and repeated values are the client door", () => {
    expect(parseDoor("provider")).toBe("provider");
    expect(parseDoor("admin")).toBe("admin");
    expect(parseDoor("client")).toBe("client");
    expect(parseDoor(["provider", "admin"])).toBe("provider");
    for (const bad of ["ADMIN", "root", "", undefined, null, []]) expect(parseDoor(bad as string)).toBe("client");
  });

  it("keeps the two public tabs to client and provider: admin is not a tab", () => {
    expect(parseEntryRole("admin")).toBe("client");
    expect(parseEntryRole("provider")).toBe("provider");
    expect(parseEntryRole(undefined)).toBe("client");
  });

  it("names the account's own door only when it came to another one", () => {
    expect(wrongDoor("client", "PROVIDER")).toBe("provider");
    expect(wrongDoor("provider", "CLIENT")).toBe("client");
    expect(wrongDoor("client", "ADMIN")).toBe("admin");
    expect(wrongDoor("provider", "ADMIN")).toBe("admin");
    expect(wrongDoor("admin", "CLIENT")).toBe("client");
    expect(wrongDoor("admin", "PROVIDER")).toBe("provider");
  });

  it("lets the right door in, and checks no door when the caller names none (API clients)", () => {
    expect(wrongDoor("client", "CLIENT")).toBeNull();
    expect(wrongDoor("provider", "PROVIDER")).toBeNull();
    expect(wrongDoor("admin", "ADMIN")).toBeNull();
    for (const role of ["CLIENT", "PROVIDER", "ADMIN"] as const) expect(wrongDoor(undefined, role)).toBeNull();
  });
});

describe("loginSchema door", () => {
  const base = { email: "a@b.co", password: "x" };

  it("takes an optional door of client, provider or admin", () => {
    expect(loginSchema.parse(base).role).toBeUndefined();
    for (const role of ["client", "provider", "admin"] as const) expect(loginSchema.parse({ ...base, role }).role).toBe(role);
  });

  it("refuses anything else, the same for every email", () => {
    for (const role of ["CLIENT", "PROVIDER", "ADMIN", "root", "", null, 1]) {
      expect(loginSchema.safeParse({ ...base, role }).success).toBe(false);
    }
  });
});

describe("authHref and safeNext", () => {
  it("builds the door address with a safe next", () => {
    expect(authHref("/login", "provider", "/messages")).toBe("/login?role=provider&next=%2Fmessages");
    expect(authHref("/login", "admin")).toBe("/login?role=admin");
    expect(authHref("/register", "client", null)).toBe("/register?role=client");
  });

  it("drops a next that could leave the site, at every door", () => {
    for (const door of ["client", "provider", "admin"] as Door[]) {
      for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "/\t/evil.com", ""]) {
        expect(authHref("/login", door, bad)).toBe(`/login?role=${door}`);
      }
    }
  });

  it("gives the same link whether the page cleaned next first or not (the form passes the cleaned one)", () => {
    for (const raw of ["/messages", "/orders/abc?tab=1#top", "//evil.com", "x", undefined]) {
      expect(authHref("/login", "client", safeNext(raw))).toBe(authHref("/login", "client", raw));
    }
  });

  it("keeps a next with its own query and hash whole, encoded in one value", () => {
    const href = authHref("/login", "client", "/messages/new?to=u1&x=2#top");
    const qs = new URLSearchParams(href.split("?")[1]);
    expect(qs.get("role")).toBe("client");
    expect(qs.get("next")).toBe("/messages/new?to=u1&x=2#top");
  });
});

describe("loginPathFor (a signed-out visitor of a protected path)", () => {
  it("names the door for the pages only one role may open", () => {
    expect(loginPathFor("/admin")).toBe("/login?role=admin");
    expect(loginPathFor("/admin/payments")).toBe("/login?role=admin");
    expect(loginPathFor("/dashboard/provider")).toBe("/login?role=provider");
    expect(loginPathFor("/dashboard/provider/profile/wizard")).toBe("/login?role=provider");
    expect(loginPathFor("/dashboard/client")).toBe("/login?role=client");
    expect(loginPathFor("/checkout/abc123")).toBe("/login?role=client");
    expect(loginPathFor("/orders/new")).toBe("/login?role=client");
  });

  it("ignores the last-role cookie where the path names the door", () => {
    expect(loginPathFor("/admin", "client")).toBe("/login?role=admin");
    expect(loginPathFor("/dashboard/client", "provider")).toBe("/login?role=client");
    expect(loginPathFor("/dashboard/provider", "admin")).toBe("/login?role=provider");
  });

  it("uses the last-role cookie for the shared pages, and the client door without one", () => {
    for (const path of ["/orders/abc123", "/messages", "/messages/xyz", "/orders"]) {
      expect(loginPathFor(path, "provider")).toBe("/login?role=provider");
      expect(loginPathFor(path, "admin")).toBe("/login?role=admin");
      expect(loginPathFor(path, "client")).toBe("/login?role=client");
      expect(loginPathFor(path)).toBe("/login?role=client");
    }
  });

  it("treats a missing, unknown or tampered cookie as the client door", () => {
    for (const bad of [undefined, null, "", "ADMIN", "superuser", "provider; admin", "../admin"]) {
      expect(loginPathFor("/messages", bad)).toBe("/login?role=client");
    }
  });

  it("does not mistake a lookalike path for a protected one", () => {
    expect(loginPathFor("/administrator", "provider")).toBe("/login?role=provider");
    expect(loginPathFor("/dashboard/provider-x", "client")).toBe("/login?role=client");
    expect(loginPathFor("/orders/newsletter", "provider")).toBe("/login?role=provider");
  });

  it("adds no next: a signed-out visitor was never sent back to the page", () => {
    expect(loginPathFor("/messages", "provider")).not.toContain("next");
  });
});

describe("doorForRoles (what requirePageRole uses: it cannot see the path)", () => {
  it("gives a page for one role that role's door", () => {
    expect(doorForRoles(["ADMIN"])).toBe("admin");
    expect(doorForRoles(["PROVIDER"], "client")).toBe("provider");
    expect(doorForRoles(["CLIENT"], "admin")).toBe("client");
  });

  it("gives a page shared by several roles the last-used door, then client", () => {
    expect(doorForRoles(["CLIENT", "PROVIDER"], "provider")).toBe("provider");
    expect(doorForRoles(["CLIENT", "PROVIDER", "ADMIN"], "admin")).toBe("admin");
    expect(doorForRoles(["CLIENT", "PROVIDER"])).toBe("client");
    expect(doorForRoles(["CLIENT", "PROVIDER"], "nonsense")).toBe("client");
  });

  it("agrees with loginPathFor for the pages that use it", () => {
    const pages: [string, Parameters<typeof doorForRoles>[0]][] = [
      ["/admin/orders", ["ADMIN"]],
      ["/dashboard/provider", ["PROVIDER"]],
      ["/dashboard/provider/profile/wizard", ["PROVIDER"]],
      ["/dashboard/client", ["CLIENT"]],
      ["/checkout/abc", ["CLIENT"]],
      ["/orders/new", ["CLIENT"]],
      ["/orders/abc", ["CLIENT", "PROVIDER", "ADMIN"]],
      ["/messages", ["CLIENT", "PROVIDER"]],
    ];
    for (const last of [undefined, "client", "provider", "admin"]) {
      for (const [path, roles] of pages) {
        expect(authHref("/login", doorForRoles(roles, last))).toBe(loginPathFor(path, last));
      }
    }
  });
});
