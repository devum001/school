import { appMode } from '../services/runtimeConfig';
import type { SchoolRepository } from './demoRepository';
export type { SchoolRepository } from './demoRepository';

let liveAdapter: Partial<SchoolRepository> | null = null;
export function setLiveRepositoryAdapter(adapter: Partial<SchoolRepository> | null) {
  liveAdapter = adapter;
}

// Load local persistence and seeds only for the independent demo application.
export const repository: SchoolRepository =
  appMode === 'demo'
    ? (await import('./demoRepository')).repository
    : new Proxy({} as SchoolRepository, {
        get(_target, prop: keyof SchoolRepository) {
          if (liveAdapter && typeof liveAdapter[prop] === 'function') {
            return liveAdapter[prop];
          }
          throw new Error('Live changes require an authenticated school data adapter.');
        },
      });

