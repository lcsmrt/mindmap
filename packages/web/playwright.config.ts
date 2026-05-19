import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @mindmap/api run dev',
      port: 3000,
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command: 'pnpm --filter @mindmap/web run dev',
      url: 'http://localhost:5173',
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
  ],
});
