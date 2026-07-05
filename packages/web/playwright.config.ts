import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/auth.setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    storageState: './e2e/.auth/user.json',
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
      // NODE_ENV=test monta o seam GET /auth/__test/last-reset (M21) pro e2e
      // capturar o link de reset sem e-mail real.
      env: { NODE_ENV: 'test' },
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
