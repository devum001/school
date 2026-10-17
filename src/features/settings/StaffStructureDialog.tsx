import { useState } from 'react';
import { ZodError } from 'zod';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import { useDraftGuard } from '../academics/useDraftGuard';

export default function StaffStructureDialog({
  kind,
  departmentId,
  id,
  initialName = '',
  onClose,
}: {
  kind: 'Department' | 'Designation';
  departmentId?: string;
  id?: string;
  initialName?: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName),
    [error, setError] = useState('');
  const notify = useFeedback();
  const guard = useDraftGuard(name !== initialName, onClose);
  return (
    <Modal
      open
      onClose={guard.confirming ? guard.keepEditing : guard.requestClose}
      title={guard.confirming ? 'Discard setup changes?' : `${id ? 'Edit' : 'Add'} ${kind}`}
      description={
        guard.confirming
          ? 'Your changes have not been saved.'
          : kind === 'Department'
            ? 'Name a department for your school team.'
            : 'This designation belongs only to the selected department.'
      }
    >
      {guard.confirming ? (
        <div className="modal-actions">
          <Button variant="secondary" onClick={guard.keepEditing}>
            Keep editing
          </Button>
          <Button variant="danger" onClick={guard.discard}>
            Discard changes
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            try {
              if (kind === 'Department') repository.saveStaffDepartment(name, id);
              else repository.saveStaffDesignation(departmentId ?? '', name, id);
              notify(`${kind} saved.`);
              onClose();
            } catch (cause) {
              setError(
                cause instanceof ZodError
                  ? (cause.issues[0]?.message ?? 'Enter a valid name.')
                  : cause instanceof Error
                    ? cause.message
                    : 'Unable to save setup.',
              );
            }
          }}
        >
          <label className="settings-field">
            {kind} name
            <input
              required
              maxLength={80}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError('');
              }}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button type="submit">Save {kind}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
