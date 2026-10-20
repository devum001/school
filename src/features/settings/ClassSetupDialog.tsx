import { useState } from 'react';
import { Button, Modal } from '../../components/ui/Primitives';
import { useDraftGuard } from '../academics/useDraftGuard';
import { validateClassSetup, type ClassSetupRow } from '../../lib/classSetup';
import { useFeedback } from '../../app/useFeedback';
export default function ClassSetupDialog({
  existing,
  save,
  onClose,
}: {
  existing: string[];
  save: (rows: ClassSetupRow[]) => Promise<void>;
  onClose: () => void;
}) {
  const [rows, setRows] = useState([{ name: '', sections: '' }]);
  const [names, setNames] = useState(''),
    [pattern, setPattern] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const dirty = !!names || !!pattern || rows.some((r) => r.name || r.sections);
  const guard = useDraftGuard(dirty, onClose),
    notify = useFeedback();
  return (
    <Modal
      open
      wide
      title={guard.confirming ? 'Discard class setup?' : 'Set up classes & sections'}
      description="Create your classes and their sections together. Existing classes stay unchanged."
      onClose={() => {
        if (!busy) (guard.confirming ? guard.keepEditing : guard.requestClose)();
      }}
    >
      {guard.confirming ? (
        <div className="modal-actions">
          <Button onClick={guard.keepEditing}>Keep editing</Button>
          <Button variant="danger" onClick={guard.discard}>
            Discard changes
          </Button>
        </div>
      ) : (
        <form
          data-unsaved={dirty}
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            try {
              if (names.trim())
                throw new Error(
                  'Use Add to setup to include the pasted class names before saving.',
                );
              const input = validateClassSetup(
                rows.map((r) => ({
                  name: r.name,
                  sections: r.sections.trim() ? r.sections.split(',') : [],
                })),
                existing,
              );
              setBusy(true);
              setError('');
              await save(input);
              notify(`${input.length} classes and their sections created.`);
              guard.complete();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Unable to save class setup.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="class-setup-fields">
            <details className="class-setup-paste">
              <summary>Add several classes at once</summary>
              <div className="class-setup-row">
                <label className="field">
                  Class names, one per line
                  <textarea
                    value={names}
                    rows={4}
                    placeholder={'Class 1\nClass 2\nClass 3'}
                    onChange={(e) => setNames(e.target.value)}
                  />
                </label>
                <label className="field">
                  Sections for these classes
                  <input
                    value={pattern}
                    placeholder="A, B, C"
                    onChange={(e) => setPattern(e.target.value)}
                  />
                  <small>You can adjust each class below.</small>
                </label>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={!names.trim()}
                onClick={() => {
                  const added = names
                    .split(/\r?\n/)
                    .map((name) => name.trim())
                    .filter(Boolean)
                    .map((name) => ({ name, sections: pattern }));
                  if (added.length + rows.filter((r) => r.name || r.sections).length > 50) {
                    setError('Set up at most 50 classes per batch.');
                    return;
                  }
                  setRows((old) => [...old.filter((r) => r.name || r.sections), ...added]);
                  setNames('');
                  setError('');
                }}
              >
                Add to setup
              </Button>
            </details>
            <p>
              A class is the learning level; sections are its groups, such as A and B. Leave
              sections blank if the class has no sections.
            </p>
            {rows.map((row, index) => (
              <div className="class-setup-row" key={index}>
                <label className="field">
                  Class name
                  <input
                    required
                    maxLength={80}
                    aria-label={`Class ${index + 1} name`}
                    placeholder="Class 1 or Nursery"
                    value={row.name}
                    onChange={(e) =>
                      setRows((old) =>
                        old.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)),
                      )
                    }
                  />
                </label>
                <label className="field">
                  Sections (optional, separated by commas)
                  <input
                    maxLength={1619}
                    aria-label={`Class ${index + 1} sections`}
                    placeholder="A, B"
                    value={row.sections}
                    onChange={(e) =>
                      setRows((old) =>
                        old.map((r, i) => (i === index ? { ...r, sections: e.target.value } : r)),
                      )
                    }
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Remove class row ${index + 1}`}
                  disabled={rows.length === 1}
                  onClick={() => setRows((old) => old.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              disabled={rows.length >= 50}
              onClick={() => setRows((old) => [...old, { name: '', sections: pattern }])}
            >
              Add another class
            </Button>
            <p>
              {rows.length} classes ·{' '}
              {rows.reduce(
                (n, row) => n + row.sections.split(',').filter((s) => s.trim()).length,
                0,
              )}{' '}
              sections in this setup. Review the names before saving.
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={guard.requestClose}>
                Cancel
              </Button>
              <Button type="submit">{busy ? 'Saving setup…' : 'Create classes & sections'}</Button>
            </div>
          </fieldset>
        </form>
      )}
    </Modal>
  );
}
