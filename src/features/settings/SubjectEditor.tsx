import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useFeedback } from '../../app/useFeedback';
import { AppIcon, Button, Modal, Panel } from '../../components/ui/Primitives';
import type { ClassSubject } from '../../types/domain';
import { useDraftGuard } from '../academics/useDraftGuard';

type EditableSubject = ClassSubject & { optional?: boolean };
export default function SubjectEditor({
  name,
  configured,
  save,
  canManage = true,
  showOptional = false,
  onDirtyChange,
  initiallyUnsaved = false,
}: {
  initiallyUnsaved?: boolean;
  name: string;
  configured: EditableSubject[];
  save: (subjects: EditableSubject[]) => Promise<EditableSubject[]> | EditableSubject[];
  canManage?: boolean;
  showOptional?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const notify = useFeedback();
  const [busy, setBusy] = useState(false);
  const [subjects, setSubjects] = useState(configured.filter((s) => !s.archived));
  const [initial, setInitial] = useState(initiallyUnsaved ? '' : JSON.stringify(subjects));
  const [error, setError] = useState('');
  useEffect(() => {
    onDirtyChange?.(JSON.stringify(subjects) !== initial);
  }, [subjects, initial, onDirtyChange]);
  const guard = useDraftGuard(JSON.stringify(subjects) !== initial, () =>
    setSubjects(initial ? JSON.parse(initial) : configured.filter((s) => !s.archived)),
  );
  return (
    <Panel title={`Subjects — ${name}`}>
      <fieldset
        data-unsaved={JSON.stringify(subjects) !== initial}
        disabled={busy || !canManage}
        className="class-subject-settings"
        style={{ border: 0 }}
      >
        {subjects.map((s, i) => (
          <div className="class-subject-row" key={s.id}>
            <label className="field">
              Subject {i + 1}
              <input
                aria-label={`Subject ${i + 1} name`}
                maxLength={60}
                required
                value={s.name}
                onChange={(e) =>
                  setSubjects(
                    subjects.map((subject) =>
                      subject.id === s.id ? { ...subject, name: e.target.value } : subject,
                    ),
                  )
                }
              />
            </label>
            {showOptional && (
              <label className="access-login-field">
                <input
                  type="checkbox"
                  aria-label={`Subject ${i + 1} optional`}
                  checked={s.optional ?? false}
                  onChange={(e) =>
                    setSubjects(
                      subjects.map((subject) =>
                        subject.id === s.id ? { ...subject, optional: e.target.checked } : subject,
                      ),
                    )
                  }
                />
                Optional
              </label>
            )}
            <Button
              variant="ghost"
              aria-label={`Remove ${s.name}`}
              onClick={() => setSubjects(subjects.filter((subject) => subject.id !== s.id))}
            >
              <AppIcon name="delete" size={16} />
            </Button>
          </div>
        ))}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="inline-actions">
          <Button
            variant="secondary"
            onClick={() => setSubjects([...subjects, { id: crypto.randomUUID(), name: '' }])}
          >
            <Plus size={15} />
            Add subject
          </Button>
          <Button
            disabled={JSON.stringify(subjects) === initial}
            onClick={async () => {
              if (busy || !canManage) return;
              setBusy(true);
              try {
                const saved = await save(subjects);
                setSubjects(saved);
                setInitial(JSON.stringify(saved));
                setError('');
                notify('Class subjects saved.');
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : 'Unable to save subjects.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <AppIcon name="save" size={16} />
            Save subjects
          </Button>
        </div>
        {guard.confirming && (
          <Modal
            open
            onClose={guard.keepEditing}
            title="Discard subject changes?"
            description="Your subject changes have not been saved."
          >
            <div className="inline-actions">
              <Button variant="secondary" onClick={guard.keepEditing}>
                Keep editing
              </Button>
              <Button variant="danger" onClick={guard.discard}>
                Discard changes
              </Button>
            </div>
          </Modal>
        )}
      </fieldset>
    </Panel>
  );
}
