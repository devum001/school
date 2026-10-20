import { defineConfig } from '@playwright/test';
import live from './playwright.live.config';
export default defineConfig({
  ...live,
  testMatch: ['product-correction-live.e2e.ts', 'staff-payroll-live.e2e.ts'],
  outputDir: 'test-results/product-correction',
});
