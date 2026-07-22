import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Runs against a DEMO-MODE dev server (in-memory backend, no
 * Supabase needed), so the full UI journeys are exercised without a database.
 * Serial / single-worker because the demo backend is shared in-process state.
 */
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    navigationTimeout: 60_000,
    actionTimeout: 15_000,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Force demo mode for the test server regardless of .env.local.
    env: { NEXT_PUBLIC_DEMO_MODE: "true" },
    stdout: "pipe",
    stderr: "pipe",
  },
});
