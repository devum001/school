import { useState } from 'react';
import { Button, Modal } from '../../components/ui/Primitives';
import { useDraftGuard } from '../academics/useDraftGuard';
export default function StructureEditor({
  title,
  initialName = '',
  initialGrade,
  save,
  close,
  saved,
}: {
  title: string;
  initialName?: string;
  initialGrade?: string;
  save: (name: string, grade: string) => Promise<unknown>;
  close: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(initialName),
    [grade, setGrade] = useState(initialGrade ?? '');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const dirty = name !== initialName || grade !== (initialGrade ?? ''),
    guard = useDraftGuard(dirty && !busy, close);
  return (
    <Modal
      open
      description="Changes are saved to this school’s live workspace."
      title={guard.confirming ? 'Discard structure changes?' : title}
      onClose={() => {
        if (!busy) guard.requestClose();
      }}
    >
      {guard.confirming ? (
        <div className="live-content">
          <Button onClick={guard.keepEditing}>Keep editing</Button>
          <Button variant="danger" onClick={guard.discard}>
            Discard changes
          </Button>
        </div>
      ) : (
        <form
          className="live-form"
          data-unsaved={dirty}
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            if (!name.trim()) {
              setError('Enter a name.');
              return;
            }
            setBusy(true);
            setError('');
            try {
              await save(name.trim(), grade.trim());
              guard.complete(() => {
                saved();
                close();
              });
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Unable to save.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Name
            <input
              required
              autoFocus
              maxLength={80}
              disabled={busy}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {initialGrade !== undefined && (
            <label>
              Grade label (optional)
              <input
                maxLength={40}
                disabled={busy}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="live-actions">
            <Button type="button" variant="secondary" disabled={busy} onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
