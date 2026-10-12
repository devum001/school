import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { FeedbackContext } from './useFeedback';
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const notify = useCallback((text: string) => setMessage(text), []);
  return (
    <FeedbackContext.Provider value={notify}>
      {children}
      {message && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{message}</span>
          <button aria-label="Dismiss notification" onClick={() => setMessage('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
