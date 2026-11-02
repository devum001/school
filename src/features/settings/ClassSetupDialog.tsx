import { useState } from 'react';
import { AppIcon, Button, Modal } from '../../components/ui/Primitives';
import { Plus } from 'lucide-react';
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
  const [showBulk, setShowBulk] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const dirty = !!names || !!pattern || rows.some((r) => r.name || r.sections);
  const guard = useDraftGuard(dirty, onClose),
    notify = useFeedback();

  const totalSections = rows.reduce(
    (n, row) => n + row.sections.split(',').filter((s) => s.trim()).length,
    0,
  );

  const add11th12thPreset = () => {
    const existingSet = new Set(existing.map((n) => n.trim().toLowerCase()));
    const presetNames = [
      'Class 11 Science',
      'Class 11 Commerce',
      'Class 11 Arts',
      'Class 12 Science',
      'Class 12 Commerce',
      'Class 12 Arts',
    ].filter((n) => !existingSet.has(n.toLowerCase()));
    if (!presetNames.length) {
      setError('All 11th & 12th stream classes already exist.');
      return;
    }
    setRows((old) => [
      ...old.filter((r) => r.name || r.sections),
      ...presetNames.map((name) => ({ name, sections: pattern || 'A' })),
    ]);
    setError('');
  };

  const addAllClassesPreset = () => {
    const existingSet = new Set(existing.map((n) => n.trim().toLowerCase()));
    const presetNames = [
      ...Array.from({ length: 10 }, (_, i) => `Class ${i + 1}`),
      'Class 11 Science',
      'Class 11 Commerce',
      'Class 11 Arts',
      'Class 12 Science',
      'Class 12 Commerce',
      'Class 12 Arts',
    ].filter((n) => !existingSet.has(n.toLowerCase()));
    if (!presetNames.length) {
      setError('Classes 1–12 already exist.');
      return;
    }
    setRows((old) => [
      ...old.filter((r) => r.name || r.sections),
      ...presetNames.map((name) => ({ name, sections: pattern || 'A' })),
    ]);
    setError('');
  };

  return (
    <Modal
      open
      wide
      title={guard.confirming ? 'Discard class setup?' : 'Set up classes & sections'}
      description="Create classes and their sections. Leave sections empty if a class does not use them."
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
            {/* Quick Templates bar */}
            <div className="class-setup-quick-bar">
              <span className="class-setup-quick-label">Templates:</span>
              <button
                type="button"
                className="class-setup-chip"
                onClick={add11th12thPreset}
              >
                + 11th & 12th Streams
              </button>
              <button
                type="button"
                className="class-setup-chip"
                onClick={addAllClassesPreset}
              >
                + Classes 1–12
              </button>
              <button
                type="button"
                className={`class-setup-chip ${showBulk ? 'active' : ''}`}
                onClick={() => setShowBulk(!showBulk)}
              >
                {showBulk ? '− Hide bulk paste' : '+ Paste multiple classes'}
              </button>
            </div>

            {/* Optional Bulk Paste collapsible */}
            {showBulk && (
              <div className="class-setup-bulk-card">
                <div className="class-setup-bulk-grid">
                  <label className="field">
                    <span>Class names (one per line)</span>
                    <textarea
                      value={names}
                      rows={3}
                      placeholder={'Class 1\nClass 2\nClass 11 Science'}
                      onChange={(e) => setNames(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Default sections</span>
                    <input
                      value={pattern}
                      placeholder="e.g. A, B"
                      onChange={(e) => setPattern(e.target.value)}
                    />
                    <small>Applied to pasted classes</small>
                  </label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
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
                </div>
              </div>
            )}

            {/* Table */}
            <div className="table-wrap class-setup-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '48%' }}>Class Name</th>
                    <th scope="col" style={{ width: '42%' }}>Sections (Optional)</th>
                    <th scope="col" style={{ width: '10%', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          required
                          maxLength={80}
                          className="class-table-input"
                          aria-label={`Class ${index + 1} name`}
                          placeholder="e.g. Class 1 or Nursery"
                          value={row.name}
                          onChange={(e) =>
                            setRows((old) =>
                              old.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          maxLength={1619}
                          className="class-table-input"
                          aria-label={`Class ${index + 1} sections`}
                          placeholder="e.g. A, B"
                          value={row.sections}
                          onChange={(e) =>
                            setRows((old) =>
                              old.map((r, i) => (i === index ? { ...r, sections: e.target.value } : r)),
                            )
                          }
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="class-row-delete"
                          aria-label={`Remove row ${index + 1}`}
                          disabled={rows.length === 1}
                          onClick={() => setRows((old) => old.filter((_, i) => i !== index))}
                          title="Remove class"
                        >
                          <AppIcon name="delete" size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Add & Summary row */}
            <div className="class-setup-table-foot">
              <Button
                type="button"
                variant="secondary"
                disabled={rows.length >= 50}
                onClick={() => setRows((old) => [...old, { name: '', sections: pattern }])}
              >
                <Plus size={14} /> Add another class
              </Button>
              <span className="class-setup-count-badge">
                {rows.length} class{rows.length === 1 ? '' : 'es'} · {totalSections} section{totalSections === 1 ? '' : 's'} in setup
              </span>
            </div>

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
