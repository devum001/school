import { appMode } from '../services/runtimeConfig';

export const router =
  appMode === 'live'
    ? (await import('./liveRouter')).liveRouter
    : (await import('./demoRouter')).demoRouter;
