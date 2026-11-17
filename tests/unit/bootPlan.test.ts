import { describe, expect, it } from "vitest";
import { planBoot } from "../../scripts/bootPlan.mjs";

const dirs = ["20261110094919_init", "20261114120000_manual_payments", "20261116090000_category_name_ru"];
const base = { migrationDirs: dirs, applied: dirs, hasFailed: false, storedHash: "aaa", currentHash: "aaa" };

describe("planBoot (what the container does before the app starts)", () => {
  it("a plain wake-up of an up-to-date database does nothing", () => {
    expect(planBoot(base)).toMatchObject({ migrate: false, constraints: false });
  });

  it("a new migration in the code: migrate, then constraints (it may have made a table that must be locked down)", () => {
    const plan = planBoot({ ...base, migrationDirs: [...dirs, "20261117120000_perf_indexes"] });
    expect(plan).toMatchObject({ migrate: true, constraints: true });
    expect(plan.reason).toContain("20261117120000_perf_indexes");
  });

  it("a changed constraints.sql: constraints only, no migrate", () => {
    expect(planBoot({ ...base, currentHash: "bbb" })).toMatchObject({ migrate: false, constraints: true, reason: "constraints.sql changed" });
  });

  it("a database that was never stamped (the first start after this change): constraints once, then it is remembered", () => {
    expect(planBoot({ ...base, storedHash: null })).toMatchObject({ migrate: false, constraints: true });
  });

  it("a failed migration in the history: run everything so the normal command reports it", () => {
    expect(planBoot({ ...base, hasFailed: true })).toMatchObject({ migrate: true, constraints: true });
  });

  it("migrations the database has but this code does not (an older build started again) are not 'pending'", () => {
    expect(planBoot({ ...base, applied: [...dirs, "20270101000000_from_the_future"] })).toMatchObject({ migrate: false, constraints: false });
  });

  it("an empty database applies every migration", () => {
    expect(planBoot({ ...base, applied: [], storedHash: null })).toMatchObject({ migrate: true, constraints: true });
  });
});
