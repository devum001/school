import { useCallback, useState } from 'react';
import { useRemote } from '../live/useRemote';
import type { Page } from '../../services/schoolSetupService';
// Mount with a school/year key. The cursor is explicit; list reads stay bounded.
export function useSetupList<T>(load: (signal: AbortSignal, after?: string) => Promise<Page<T>>) {
  const [after, setAfter] = useState<string>();
  const request = useCallback((signal: AbortSignal) => load(signal, after), [load, after]);
  const state = useRemote(request);
  return {
    ...state,
    next: () => {
      if (state.data?.nextCursor) setAfter(state.data.nextCursor);
    },
    first: useCallback(() => setAfter(undefined), []),
    hasPrevious: !!after,
  };
}
