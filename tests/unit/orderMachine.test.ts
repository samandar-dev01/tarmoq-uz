import { describe, it, expect } from "vitest";
import { assertTransition, canTransition } from "@/lib/orderMachine";
import { HttpError } from "@/lib/errors";

const STATUSES = ["REQUESTED", "AGREEMENT_PENDING", "AWAITING_PAYMENT", "IN_PROGRESS", "DELIVERED", "COMPLETED", "CANCELLED", "DISPUTED"] as const;
const ACTORS = ["client", "provider", "admin", "system"] as const;

describe("order state machine", () => {
  it("lets only the provider send terms", () => {
    expect(canTransition("REQUESTED", "AGREEMENT_PENDING", "provider")).toBe(true);
    expect(canTransition("REQUESTED", "AGREEMENT_PENDING", "client")).toBe(false);
  });

  it("moves to payment and into progress only via the system (after verified acceptance / payment)", () => {
    expect(canTransition("AGREEMENT_PENDING", "AWAITING_PAYMENT", "system")).toBe(true);
    expect(canTransition("AGREEMENT_PENDING", "AWAITING_PAYMENT", "client")).toBe(false);
    expect(canTransition("AWAITING_PAYMENT", "IN_PROGRESS", "system")).toBe(true);
    expect(canTransition("AWAITING_PAYMENT", "IN_PROGRESS", "client")).toBe(false);
    expect(canTransition("AWAITING_PAYMENT", "IN_PROGRESS", "provider")).toBe(false);
  });

  it("lets the provider deliver and only the client approve", () => {
    expect(canTransition("IN_PROGRESS", "DELIVERED", "provider")).toBe(true);
    expect(canTransition("IN_PROGRESS", "DELIVERED", "client")).toBe(false);
    expect(canTransition("DELIVERED", "COMPLETED", "client")).toBe(true);
    expect(canTransition("DELIVERED", "COMPLETED", "provider")).toBe(false);
  });

  it("allows revisions only for the client, from DELIVERED", () => {
    expect(canTransition("DELIVERED", "IN_PROGRESS", "client")).toBe(true);
    expect(canTransition("DELIVERED", "IN_PROGRESS", "provider")).toBe(false);
  });

  it("cannot cancel once work is paid for; use a dispute instead", () => {
    for (const from of ["IN_PROGRESS", "DELIVERED"] as const) {
      for (const actor of ACTORS) expect(canTransition(from, "CANCELLED", actor)).toBe(false);
      expect(canTransition(from, "DISPUTED", "client")).toBe(true);
      expect(canTransition(from, "DISPUTED", "provider")).toBe(true);
    }
  });

  it("allows cancelling before payment by client or provider", () => {
    for (const from of ["REQUESTED", "AGREEMENT_PENDING", "AWAITING_PAYMENT"] as const) {
      expect(canTransition(from, "CANCELLED", "client")).toBe(true);
      expect(canTransition(from, "CANCELLED", "provider")).toBe(true);
    }
  });

  it("only an admin can resolve a dispute", () => {
    expect(canTransition("DISPUTED", "COMPLETED", "admin")).toBe(true);
    expect(canTransition("DISPUTED", "CANCELLED", "admin")).toBe(true);
    for (const actor of ["client", "provider", "system"] as const) {
      expect(canTransition("DISPUTED", "COMPLETED", actor)).toBe(false);
      expect(canTransition("DISPUTED", "CANCELLED", actor)).toBe(false);
    }
  });

  it("COMPLETED and CANCELLED are terminal for everyone", () => {
    for (const from of ["COMPLETED", "CANCELLED"] as const) {
      for (const to of STATUSES) for (const actor of ACTORS) expect(canTransition(from, to, actor)).toBe(false);
    }
  });

  it("cannot skip steps", () => {
    for (const actor of ACTORS) {
      expect(canTransition("REQUESTED", "IN_PROGRESS", actor)).toBe(false);
      expect(canTransition("REQUESTED", "COMPLETED", actor)).toBe(false);
      expect(canTransition("AWAITING_PAYMENT", "DELIVERED", actor)).toBe(false);
      expect(canTransition("AWAITING_PAYMENT", "COMPLETED", actor)).toBe(false);
    }
  });

  it("assertTransition throws a 409 HttpError for illegal moves", () => {
    try {
      assertTransition("REQUESTED", "COMPLETED", "client");
      throw new Error("expected assertTransition to throw");
    } catch (e) {
      expect(e instanceof HttpError).toBe(true);
      expect((e as HttpError).status).toBe(409);
    }
  });
});
