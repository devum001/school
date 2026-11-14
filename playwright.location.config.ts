import { defineConfig } from '@playwright/test';
import live from './playwright.fees.config';
export default defineConfig({
  ...live,
  testMatch: 'location-live.e2e.ts',
  outputDir: 'test-results/location',
});
