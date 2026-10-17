import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
export function useDraftGuard(dirty: boolean, onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const approvedNavigation = useRef(false);
  const blocker = useBlocker(() => dirty && !approvedNavigation.current);
  useEffect(() => {
    if (!dirty) approvedNavigation.current = false;
  }, [dirty]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty && !approvedNavigation.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  return {
    complete: (action: () => void = onClose) => {
      approvedNavigation.current = true;
      setClosing(false);
      action();
    },
    confirming: closing || blocker.state === 'blocked',
    requestClose: () => {
      if (dirty) setClosing(true);
      else onClose();
    },
    keepEditing: () => {
      approvedNavigation.current = false;
      setClosing(false);
      if (blocker.state === 'blocked') blocker.reset();
    },
    discard: () => {
      approvedNavigation.current = true;
      setClosing(false);
      if (blocker.state === 'blocked') blocker.proceed();
      else onClose();
    },
  };
}
