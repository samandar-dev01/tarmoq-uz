import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  workers: 1, // flows share seeded demo data
  retries: 0,
  expect: { timeout: 20_000 }, // first request to a page compiles it in dev mode
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure", navigationTimeout: 60_000 },
  webServer: {
    command: "npm run dev",
    env: { RATE_LIMIT_DISABLED: "true" }, // the suite registers many accounts from one address
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
