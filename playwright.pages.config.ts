import { defineConfig, devices } from '@playwright/test'

const baseURL =
  process.env.PAGES_URL ?? 'http://localhost:5185/iframe-playground/'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'pages.spec.ts',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.CI ? {} : { channel: 'chrome' }),
      },
    },
  ],
  webServer: process.env.PAGES_URL
    ? undefined
    : {
        command: 'npm run preview:pages',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
})
