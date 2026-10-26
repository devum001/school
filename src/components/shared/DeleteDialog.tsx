import { useState } from 'react';
import { Button, Modal } from '../ui/Primitives';
export default function DeleteDialog({
  title,
  description,
  detail,
  onDelete,
  onClose,
  archive = false,
}: {
  title: string;
  description: string;
  detail?: string;
  onDelete: () => void | Promise<void>;
  archive?: boolean;
  onClose: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={title}
      description={description}
    >
      {detail && <p className="panel-note">{detail}</p>}
      <p className="form-error">
        {archive ? 'This record stays available in history.' : 'This deletion cannot be undone.'}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <Button disabled={busy} variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={busy}
          variant="danger"
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await onDelete();
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unable to delete this record.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Saving…' : archive ? 'Archive record' : 'Delete permanently'}
        </Button>
      </div>
    </Modal>
  );
}
