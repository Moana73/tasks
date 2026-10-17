import { defineConfig, devices } from '@playwright/test';

const PORT = 8790;

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // iPhone 15 Pro 相当（393×852, タッチ, モバイル UA）。CI 環境の都合でエンジンは Chromium
    ...devices['iPhone 15 Pro'],
    browserName: 'chromium',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/local-server.mjs',
    url: `http://localhost:${PORT}/manifest.webmanifest`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      FRESH_DB: 'true',
      DB_PATH: '.local/e2e.sqlite',
      DEV_LOGIN: 'true',
      AI_MOCK: 'true',
    },
  },
});
