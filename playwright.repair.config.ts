import { defineConfig } from '@playwright/test';
import live from './playwright.live.config';
export default defineConfig({
  ...live,
  testMatch: 'phase1-repair.e2e.ts',
  outputDir: 'test-results/phase1-repair',
});
