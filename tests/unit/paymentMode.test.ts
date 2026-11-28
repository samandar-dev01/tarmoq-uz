import { afterEach, describe, expect, it, vi } from "vitest";
import { manualPaymentsOn, paymentsAreTest } from "@/lib/payments/mode";

const set = (provider: string | undefined, nodeEnv: string) => {
  vi.stubEnv("PAYMENT_PROVIDER", provider);
  vi.stubEnv("NODE_ENV", nodeEnv);
};

describe("which payments are on", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is the sandbox by default away from production", () => {
    for (const env of ["development", "test"]) {
      set(undefined, env);
      expect(paymentsAreTest()).toBe(true);
    }
  });

  it("stays closed on a production server whose setting is missing", () => {
    set(undefined, "production");
    expect(paymentsAreTest()).toBe(false);
    expect(manualPaymentsOn()).toBe(false);
  });

  it("follows the setting when there is one", () => {
    set("sandbox", "production");
    expect(paymentsAreTest()).toBe(true);
    set("manual", "production");
    expect(paymentsAreTest()).toBe(false);
    expect(manualPaymentsOn()).toBe(true);
    set("", "development");
    expect(paymentsAreTest()).toBe(false);
  });
});
