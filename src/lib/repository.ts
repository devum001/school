import { appMode } from '../services/runtimeConfig';
import type { SchoolRepository } from './demoRepository';
export type { SchoolRepository } from './demoRepository';
// Load local persistence and seeds only for the independent demo application.
export const repository: SchoolRepository =
  appMode === 'demo'
    ? (await import('./demoRepository')).repository
    : new Proxy({} as SchoolRepository, {
        get() {
          throw new Error('Live changes require an authenticated school data adapter.');
        },
      });
