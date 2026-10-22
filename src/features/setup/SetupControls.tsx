import { useState } from 'react';
import type { ReactNode } from 'react';
import { AppLoader, Button, Modal, useWorkspaceLoading } from '../../components/ui/Primitives';
export function LoadState({
  loading,
  error,
  retry,
  label = 'Loading school setup…',
}: {
  loading: boolean;
  error?: string;
  retry: () => void;
  label?: string;
}) {
  const delegated = useWorkspaceLoading(loading, label, label);
  if (loading) {
    if (delegated) return null;
    return (
      <div className="loading-state">
        <AppLoader size="xl" label={label} message={label} />
      </div>
    );
  }
  return error ? (
    <div>
      <p role="alert" className="form-error">
        {error}
      </p>
      <Button variant="secondary" onClick={retry}>
        Retry
      </Button>
    </div>
  ) : null;
}
export function Paging({
  nextCursor,
  hasPrevious,
  next,
  first,
}: {
  nextCursor?: string | null;
  hasPrevious: boolean;
  next: () => void;
  first: () => void;
}) {
  return (
    <div className="live-actions">
      {hasPrevious && (
        <Button variant="secondary" onClick={first}>
          First page
        </Button>
      )}
      {nextCursor && (
        <Button variant="secondary" onClick={next}>
          Next page
        </Button>
      )}
    </div>
  );
}
export function ConfirmAction({
  title,
  description,
  action,
  close,
  saved,
}: {
  title: string;
  description: ReactNode;
  action: () => Promise<unknown>;
  close: () => void;
  saved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal
      open
      description="Changes are saved to this school’s live workspace."
      title={title}
      onClose={() => {
        if (!busy) close();
      }}
    >
      <div className="live-content">
        <p>{description}</p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="live-actions">
          <Button variant="secondary" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await action();
                saved();
                close();
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : 'Unable to save. Refresh and try again.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Saving…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
