import { describe, expect, it } from "vitest";
import { canAsk } from "@/lib/resolution";
import { cancelAgreedMessage } from "@/lib/notify";

describe("resolution centre", () => {
  it("extends only work in progress, and cancels only once money is held", () => {
    expect(canAsk("EXTEND", "IN_PROGRESS")).toBe(true);
    expect(canAsk("EXTEND", "DELIVERED")).toBe(false);
    expect(canAsk("CANCEL", "DELIVERED")).toBe(true);
    for (const status of ["REQUESTED", "AGREEMENT_PENDING", "AWAITING_PAYMENT", "COMPLETED", "CANCELLED", "DISPUTED"] as const) {
      expect(canAsk("CANCEL", status)).toBe(false);
    }
  });

  it("tells the admin the order code only", () => {
    const text = cancelAgreedMessage({ reference: "AB12CD" });
    expect(text).toContain("AB12CD");
    expect(text).toContain("/admin/orders");
  });
});
