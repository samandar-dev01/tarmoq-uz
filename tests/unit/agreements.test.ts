import { describe, it, expect } from "vitest";
import { buildTermsText, hashTerms } from "@/lib/agreements";

const base = {
  orderId: "order_1", version: 1, serviceTitle: "Instagram Reel", clientName: "Demo Client",
  providerName: "Jasur Karimov", price: 300000, deliveryDays: 2, revisions: 1, feePercent: 10,
};

describe("agreements", () => {
  it("states price, delivery, revisions and fee in the terms", () => {
    const text = buildTermsText(base);
    expect(text).toContain("version 1");
    expect(text).toContain("Instagram Reel");
    expect(text).toContain("2 days");
    expect(text).toContain("10%");
    expect(text).toContain("Jasur Karimov");
  });

  it("includes provider notes when given", () => {
    expect(buildTermsText({ ...base, notes: "Two locations" })).toContain("Two locations");
  });

  it("produces a stable 64-character hash", () => {
    const t = { orderId: "order_1", version: 1, price: 300000, deliveryDays: 2, revisions: 1, termsText: buildTermsText(base) };
    expect(hashTerms(t)).toBe(hashTerms({ ...t }));
    expect(hashTerms(t)).toHaveLength(64);
  });

  it("changes the hash whenever any accepted term changes", () => {
    const t = { orderId: "order_1", version: 1, price: 300000, deliveryDays: 2, revisions: 1, termsText: "terms" };
    const h = hashTerms(t);
    expect(hashTerms({ ...t, price: 300001 })).not.toBe(h);
    expect(hashTerms({ ...t, deliveryDays: 3 })).not.toBe(h);
    expect(hashTerms({ ...t, revisions: 2 })).not.toBe(h);
    expect(hashTerms({ ...t, version: 2 })).not.toBe(h);
    expect(hashTerms({ ...t, orderId: "order_2" })).not.toBe(h);
    expect(hashTerms({ ...t, termsText: "terms!" })).not.toBe(h);
  });
});
