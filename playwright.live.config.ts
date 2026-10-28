import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results/live',
  testMatch: 'live-api.e2e.ts',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5176',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH, args: ['--no-sandbox'] },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1050 } },
    },
  ],
  webServer: [
    {
      command: './node_modules/.bin/ts-node src/test/phase3BrowserServer.ts',
      cwd:
        process.env.SCHOOL_BACKEND_TEST_DIR ||
        '/home/devendra/scholl backend/type-ORM-backend-Node',
      url: 'http://127.0.0.1:3107/health/ready',
      gracefulShutdown: { signal: 'SIGTERM', timeout: 20000 },
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5176 --strictPort',
      env: { VITE_APP_MODE: 'live', VITE_API_BASE_URL: 'http://127.0.0.1:3107/api/v1' },
      url: 'http://127.0.0.1:5176',
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
