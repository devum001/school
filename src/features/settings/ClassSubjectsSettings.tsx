import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { AppIcon, Button, Modal, Panel } from '../../components/ui/Primitives';
import { classSubjects } from '../../lib/classSubjects';
import { repository } from '../../lib/repository';
import { useDraftGuard } from '../academics/useDraftGuard';

export default function ClassSubjectsSettings({
  classId,
  onDirtyChange,
}: {
  classId: string;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const state = useSchool(),
    notify = useFeedback();
  const configured = classSubjects(state, classId);
  const [subjects, setSubjects] = useState(configured.filter((s) => !s.archived));
  const [initial, setInitial] = useState(JSON.stringify(subjects));
  const [error, setError] = useState('');
  useEffect(() => {
    onDirtyChange?.(JSON.stringify(subjects) !== initial);
  }, [subjects, initial, onDirtyChange]);
  const guard = useDraftGuard(JSON.stringify(subjects) !== initial, () =>
    setSubjects(JSON.parse(initial)),
  );
  return (
    <Panel title={`Subjects — ${state.classes.find((c) => c.id === classId)?.name}`}>
      <div className="class-subject-settings">
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
      </div>
    </Panel>
  );
}
