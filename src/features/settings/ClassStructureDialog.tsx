import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import { useDraftGuard } from '../academics/useDraftGuard';

export default function ClassStructureDialog({
  kind,
  id,
  classId,
  onClose,
}: {
  kind: 'class' | 'section';
  id?: string;
  classId?: string;
  onClose: () => void;
}) {
  const state = useSchool();
  const notify = useFeedback();
  const existingClass = state.classes.find((c) => c.id === id);
  const existingSection = state.sections.find((s) => s.id === id);
  const [initial] = useState(() => ({
    name: (kind === 'class' ? existingClass : existingSection)?.name ?? '',
    grade: existingClass?.grade ?? '',
    teacherId: existingSection?.teacherId ?? '',
  }));
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const guard = useDraftGuard(JSON.stringify(initial) !== JSON.stringify(draft), onClose);
  return (
    <Modal
      open
      onClose={guard.confirming ? guard.keepEditing : guard.requestClose}
      title={
        guard.confirming
          ? 'Discard setup changes?'
          : `${id ? 'Edit' : 'Add'} ${kind === 'class' ? 'Class / Grade' : 'section'}`
      }
      description={
        guard.confirming
          ? 'Your changes have not been saved.'
          : kind === 'class'
            ? 'Use the names and grade labels your school follows.'
            : 'Create a section under this class and optionally assign its class teacher.'
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
              if (kind === 'class')
                repository.saveSchoolClass({ name: draft.name, grade: draft.grade }, id);
              else
                repository.saveSchoolSection(
                  {
                    name: draft.name,
                    teacherId: draft.teacherId,
                    classId: existingSection?.classId ?? classId ?? '',
                  },
                  id,
                );
              notify(`${kind === 'class' ? 'Class' : 'Section'} saved.`);
              onClose();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Unable to save setup.');
            }
          }}
        >
          <div className="student-timing-form-grid">
            <label className="student-timing-field full">
              {kind === 'class' ? 'Class / Grade name' : 'Section name'}
              <input
                required
                maxLength={80}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={
                  kind === 'class' ? 'For example, Class 6 or Nursery' : 'For example, A or Blue'
                }
              />
            </label>
            {kind === 'class' ? (
              <label className="student-timing-field full">
                Grade / level (optional)
                <input
                  maxLength={80}
                  value={draft.grade}
                  onChange={(e) => setDraft({ ...draft, grade: e.target.value })}
                  placeholder="For example, Grade 6 or Pre-primary"
                />
              </label>
            ) : (
              <label className="student-timing-field full">
                Class teacher
                <select
                  value={draft.teacherId}
                  onChange={(e) => setDraft({ ...draft, teacherId: e.target.value })}
                >
                  <option value="">Not assigned</option>
                  {state.teachers
                    .filter(
                      (t) =>
                        t.schoolId === state.school.id &&
                        (t.status === 'active' || t.id === draft.teacherId),
                    )
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button type="submit">Save {kind === 'class' ? 'Class / Grade' : 'section'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
