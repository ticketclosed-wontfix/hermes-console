import { defineConfig, devices } from '@playwright/test'

// Talk to the live systemd-managed workspace at :3001. It is already running,
// and it is the only place where the built UI + gateway proxy actually exist.
// Do NOT start a dev server; we want to test the real production build.
const BASE_URL = process.env.HERMES_E2E_BASE_URL || 'http://127.0.0.1:3001'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
