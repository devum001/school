import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5175',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH, args: ['--no-sandbox'] },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1050 } },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
