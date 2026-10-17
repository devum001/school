import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { FeedbackContext } from './useFeedback';
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<{ id: number; text: string } | null>(null);
  const sequence = useRef(0);
  const notify = useCallback((text: string) => setMessage({ id: ++sequence.current, text }), []);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);
  return (
    <FeedbackContext.Provider value={notify}>
      {children}
      {message && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{message.text}</span>
          <button aria-label="Dismiss notification" onClick={() => setMessage(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
