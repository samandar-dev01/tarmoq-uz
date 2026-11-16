import { describe, expect, it } from "vitest";
import { isCurrentPath } from "@/lib/currentPath";
import { accountMenuLinks, footerLinks, headerLinks, ROLE_LABEL } from "@/lib/shellNav";
import type { AppRole } from "@/lib/token";

// What the app shell offers to each kind of visitor: the header's plain links, the account menu, the footer.

const labels = (links: { label: string }[]) => links.map((l) => l.label);
const CLIENT = { role: "CLIENT" as const };
const CREATOR = { role: "PROVIDER" as const };
const ADMIN = { role: "ADMIN" as const };

describe("the account menu", () => {
  it("gives a client the cabinet, messages and the creator list, each to its own place", () => {
    expect(accountMenuLinks(CLIENT)).toEqual([
      { href: "/dashboard/client", label: "Kabinet" },
      { href: "/messages", label: "Xabarlar" },
      { href: "/search", label: "Ijodkorlar" },
    ]);
  });

  it("gives a creator the cabinet and messages, never the creator list", () => {
    expect(accountMenuLinks(CREATOR)).toEqual([
      { href: "/dashboard/provider", label: "Kabinet" },
      { href: "/messages", label: "Xabarlar" },
    ]);
  });

  it("gives an admin the admin area and the creator list, and no messages", () => {
    expect(accountMenuLinks(ADMIN)).toEqual([
      { href: "/admin", label: "Admin" },
      { href: "/search", label: "Ijodkorlar" },
    ]);
  });
});

describe("the header's plain links", () => {
  it("lets a visitor see the creator list only (the sign-in buttons are written by the header)", () => {
    expect(headerLinks(null)).toEqual([{ href: "/search", label: "Ijodkorlar" }]);
  });

  it("is the creator list and messages for a client, messages only for a creator, the creator list only for an admin", () => {
    expect(labels(headerLinks(CLIENT))).toEqual(["Ijodkorlar", "Xabarlar"]);
    expect(labels(headerLinks(CREATOR))).toEqual(["Xabarlar"]);
    expect(labels(headerLinks(ADMIN))).toEqual(["Ijodkorlar"]);
  });

  it("never links the creator list to a creator, or messages to an admin or a visitor, anywhere in the shell", () => {
    const everywhere = (v: { role: AppRole } | null) => [...headerLinks(v), ...footerLinks(v), ...(v ? accountMenuLinks(v) : [])].map((l) => l.href);
    expect(everywhere(CREATOR)).not.toContain("/search");
    expect(everywhere(ADMIN)).not.toContain("/messages");
    expect(everywhere(null)).not.toContain("/messages");
  });
});

describe("the footer", () => {
  it("keeps today's three links for a visitor, in today's order", () => {
    expect(footerLinks(null)).toEqual([
      { href: "/search", label: "Ijodkorlar" },
      { href: "/register?role=provider", label: "Ijodkor boʻlib qoʻshilish" },
      { href: "/register?role=client", label: "Buyurtma bermoqchiman" },
    ]);
  });

  it("gives a client Ijodkorlar, Kabinet and Xabarlar", () => {
    expect(labels(footerLinks(CLIENT))).toEqual(["Ijodkorlar", "Kabinet", "Xabarlar"]);
  });

  it("gives a creator Kabinet and Xabarlar", () => {
    expect(labels(footerLinks(CREATOR))).toEqual(["Kabinet", "Xabarlar"]);
  });

  it("gives an admin the admin area only", () => {
    expect(footerLinks(ADMIN)).toEqual([{ href: "/admin", label: "Admin" }]);
  });

  it("asks nobody who is signed in to sign up", () => {
    for (const viewer of [CLIENT, CREATOR, ADMIN]) {
      expect(footerLinks(viewer).filter((l) => l.href.startsWith("/register"))).toEqual([]);
    }
  });
});

describe("the role in words", () => {
  it("says it the way the sign-in tabs do", () => {
    expect(ROLE_LABEL).toEqual({ CLIENT: "Mijoz", PROVIDER: "Ijodkor", ADMIN: "Admin" });
  });
});

describe("isCurrentPath", () => {
  it("matches the page itself and the pages below it, not a longer name that merely starts the same", () => {
    expect(isCurrentPath("/dashboard/client", "/dashboard/client")).toBe(true);
    expect(isCurrentPath("/dashboard/client/orders", "/dashboard/client")).toBe(true);
    expect(isCurrentPath("/dashboard/clients", "/dashboard/client")).toBe(false);
    expect(isCurrentPath("/", "/messages")).toBe(false);
  });

  it("ignores a query string in the link, and asks for the very page with `exact`", () => {
    expect(isCurrentPath("/login", "/login?role=client")).toBe(true);
    expect(isCurrentPath("/admin/orders", "/admin", true)).toBe(false);
    expect(isCurrentPath("/admin", "/admin", true)).toBe(true);
  });
});
