import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
export function useDraftGuard(dirty: boolean, onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const blocker = useBlocker(dirty);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  return {
    confirming: closing || blocker.state === 'blocked',
    requestClose: () => {
      if (dirty) setClosing(true);
      else onClose();
    },
    keepEditing: () => {
      setClosing(false);
      if (blocker.state === 'blocked') blocker.reset();
    },
    discard: () => {
      if (blocker.state === 'blocked') blocker.proceed();
      else onClose();
    },
  };
}
