import { defineConfig } from '@playwright/test';
import live from './playwright.fees.config';
const servers = live.webServer as Exclude<typeof live.webServer, undefined> &
  { env?: Record<string, string> }[];
export default defineConfig({
  ...live,
  testMatch: 'attendance-ars-live.e2e.ts',
  outputDir: 'test-results/ars',
  webServer: servers.map((server, index) =>
    index === 0 ? { ...server, env: { ...server.env, ARS_BROWSER_FIXTURE: 'true' } } : server,
  ),
});
