import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/pages.spec.ts',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5183', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: [
    {
      command: process.env.TEST_PRODUCTION
        ? 'npm run preview:host'
        : 'npm run dev:host',
      url: 'http://localhost:5183',
      reuseExistingServer: !process.env.TEST_PRODUCTION,
      timeout: 30_000,
    },
    {
      command: process.env.TEST_PRODUCTION
        ? 'npm run preview:provider'
        : 'npm run dev:provider',
      url: 'http://localhost:5184/component.js',
      reuseExistingServer: !process.env.TEST_PRODUCTION,
      timeout: 30_000,
    },
  ],
})
