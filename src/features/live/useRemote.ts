import { useEffect, useState } from 'react';
import { apiService, isCancelled } from '../../services/apiService';
import { accessError } from '../../services/schoolAccessService';
// Callers memoize load; each school/tab gets a separate mounted instance.
export function useRemote<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({
    loading: true,
  });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    load(controller.signal).then(
      (data) => {
        if (active) setState({ data, loading: false });
      },
      (error) => {
        if (active && !isCancelled(error)) setState({ error: accessError(error), loading: false });
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [load, attempt]);
  return {
    ...state,
    reload: () => {
      apiService.invalidateReads();
      setState({ loading: true });
      setAttempt((value) => value + 1);
    },
  };
}
