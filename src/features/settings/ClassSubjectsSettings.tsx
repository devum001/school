import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, Panel } from '../../components/ui/Primitives';
import { classSubjects } from '../../lib/classSubjects';
import { repository } from '../../lib/repository';
import { useDraftGuard } from '../academics/useDraftGuard';

export default function ClassSubjectsSettings({
  classId,
  onDirtyChange,
}: {
  classId: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const state = useSchool(),
    notify = useFeedback();
  const configured = classSubjects(state, classId);
  const [subjects, setSubjects] = useState(configured.filter((s) => !s.archived));
  const [initial, setInitial] = useState(JSON.stringify(subjects));
  const [error, setError] = useState('');
  useEffect(() => {
    onDirtyChange(JSON.stringify(subjects) !== initial);
  }, [subjects, initial, onDirtyChange]);
  const guard = useDraftGuard(JSON.stringify(subjects) !== initial, () =>
    setSubjects(JSON.parse(initial)),
  );
  return (
    <Panel
      title={`Subjects — ${state.classes.find((c) => c.id === classId)?.name}`}
      subtitle={`${state.school.board ?? 'School'} starting subjects. Adjust these to your school’s curriculum; they appear automatically in marks sheets.`}
    >
      <div className="class-subject-settings">
        <p>
          Renaming a subject updates its name throughout Academics. Removing a subject keeps earlier
          marks and reports.
        </p>
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
            <Button
              variant="ghost"
              aria-label={`Remove ${s.name}`}
              onClick={() => setSubjects(subjects.filter((subject) => subject.id !== s.id))}
            >
              <Trash2 size={16} />
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
            onClick={() => {
              try {
                repository.saveClassSubjects(classId, subjects);
                const saved = classSubjects(repository.getSnapshot(), classId).filter(
                  (s) => !s.archived,
                );
                setSubjects(saved);
                setInitial(JSON.stringify(saved));
                setError('');
                notify('Class subjects saved. Marks sheets and result names updated.');
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : 'Unable to save subjects.');
              }
            }}
          >
            Save subjects
          </Button>
        </div>
        {guard.confirming && (
          <div role="alert" className="sheet-import-preview">
            <p>Subject changes are not saved.</p>
            <div className="inline-actions">
              <Button variant="secondary" onClick={guard.keepEditing}>
                Keep editing
              </Button>
              <Button variant="danger" onClick={guard.discard}>
                Discard changes
              </Button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
