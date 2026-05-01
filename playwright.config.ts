import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  report: [["html", { open: "never" }], ["list"]],
  use: {
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
});
