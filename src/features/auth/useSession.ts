import { useSyncExternalStore } from 'react';
import { sessionStore } from './sessionStore';
export const useSession = () =>
  useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot);
