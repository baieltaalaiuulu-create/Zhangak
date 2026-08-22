import { defineConfig, devices } from '@playwright/test'

/**
 * Rendered acceptance tests for the student lesson video.
 *
 * Scope, stated plainly so the coverage is not overclaimed:
 *
 * - These run the real production Next.js server and the real client
 *   components. Layout, focus, keyboard and request behaviour are measured in
 *   a real browser, not asserted against source text.
 * - The first-party `/v1` API and the YouTube origins are intercepted. Server
 *   authorization is NOT proven here; it is proven against real PostgreSQL in
 *   backend/test/lesson-video-integration.test.js. The two suites are
 *   complementary and neither substitutes for the other.
 * - Real Android/iOS WebView behaviour is out of scope for this runner and
 *   remains a manual device check.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list']] : [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3311',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // The production build, not `next dev`: this is the artifact that ships.
    command: 'node scripts/prepare-e2e-standalone.mjs && node .next/standalone/server.js',
    env: { HOSTNAME: '127.0.0.1', PORT: '3311' },
    url: 'http://127.0.0.1:3311/login',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
