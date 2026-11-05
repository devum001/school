import { defineConfig } from '@playwright/test';
import live from './playwright.live.config';
export default defineConfig({
  ...live,
  testMatch: 'staff-foundation-live.e2e.ts',
  outputDir: 'test-results/staff-foundation',
});
