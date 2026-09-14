import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: process.env.CI ? 60_000 : 30_000,
  workers: process.env.CI ? 1 : undefined,
  use: { trace: "retain-on-failure" }
});
