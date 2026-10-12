import { useSyncExternalStore } from 'react';
import { getSchoolDate } from '../lib/dates';

function subscribe(listener: () => void) {
  const timer = window.setInterval(listener, 30_000);
  window.addEventListener('focus', listener);
  document.addEventListener('visibilitychange', listener);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('focus', listener);
    document.removeEventListener('visibilitychange', listener);
  };
}

export const useToday = () => useSyncExternalStore(subscribe, getSchoolDate);
