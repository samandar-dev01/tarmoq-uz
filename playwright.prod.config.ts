import { defineConfig } from "@playwright/test";

// For the production-style rig (scripts/e2e-prod/run.sh). Same options as playwright.config.ts, but it starts no
// server of its own: the rig has already built the app and started it behind the forwarder.
const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) throw new Error("E2E_BASE_URL is not set. Run this config through `npm run test:e2e:prod` (scripts/e2e-prod/run.sh).");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  workers: 1, // flows share seeded demo data
  retries: 0,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure", navigationTimeout: 60_000 },
});
