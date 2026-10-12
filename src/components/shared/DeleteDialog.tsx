import { useState } from 'react';
import { Button, Modal } from '../ui/Primitives';
export default function DeleteDialog({
  title,
  description,
  detail,
  onDelete,
  onClose,
}: {
  title: string;
  description: string;
  detail?: string;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [error, setError] = useState('');
  return (
    <Modal open onClose={onClose} title={title} description={description}>
      {detail && <p className="panel-note">{detail}</p>}
      <p className="form-error">This deletion cannot be undone.</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            try {
              onDelete();
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unable to delete this record.');
            }
          }}
        >
          Delete permanently
        </Button>
      </div>
    </Modal>
  );
}
