// @polsia:user-owned — browser-test configuration for the public area request.
import 'dotenv/config';
import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3100';
const emailProxyURL = 'http://127.0.0.1:3199';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          SKIP_ENV_VALIDATION: '1',
          POLSIA_EMAIL_PROXY_URL: emailProxyURL,
          BETTER_AUTH_URL: baseURL,
          BETTER_AUTH_TRUSTED_ORIGINS: baseURL,
        },
      },
});
