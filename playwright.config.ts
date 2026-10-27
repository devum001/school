import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results/demo',
  testMatch: '**/*.e2e.ts',
  testIgnore: [
    'live-api.e2e.ts',
    'fees-live.e2e.ts',
    'teacher-workspace-live.e2e.ts',
    'attendance-ars-live.e2e.ts',
    'phase1-repair.e2e.ts',
    'staff-payroll-live.e2e.ts',
    'product-correction-live.e2e.ts',
  ],
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
    env: { VITE_APP_MODE: 'demo' },
    command: 'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
