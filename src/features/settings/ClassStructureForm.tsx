import { useState } from 'react';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal } from '../../components/ui/Primitives';
import { useDraftGuard } from '../academics/useDraftGuard';

export type ClassFormValue = { name: string; grade: string; teacherId: string };
export default function ClassStructureForm({
  kind,
  id,
  initial,
  teachers,
  canAssignTeacher = true,
  save,
  onClose,
}: {
  kind: 'class' | 'section';
  id?: string;
  initial: ClassFormValue;
  teachers: { id: string; name: string }[];
  canAssignTeacher?: boolean;
  save: (draft: ClassFormValue) => Promise<void> | void;
  onClose: () => void;
}) {
  const notify = useFeedback();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const guard = useDraftGuard(JSON.stringify(initial) !== JSON.stringify(draft), onClose);
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) (guard.confirming ? guard.keepEditing : guard.requestClose)();
      }}
      title={
        guard.confirming
          ? 'Discard setup changes?'
          : `${id ? 'Edit' : 'Add'} ${kind === 'class' ? 'Class' : 'section'}`
      }
      description={
        guard.confirming
          ? 'Your changes have not been saved.'
          : kind === 'class'
            ? 'Use the class name your school follows.'
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
          data-unsaved={JSON.stringify(initial) !== JSON.stringify(draft)}
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              if (busy) return;
              setBusy(true);
              await save(draft);
              notify(`${kind === 'class' ? 'Class' : 'Section'} saved.`);
              guard.complete();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Unable to save setup.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} style={{ border: 0 }}>
            <div className="student-timing-form-grid">
              <label className="student-timing-field full">
                {kind === 'class' ? 'Class name' : 'Section name'}
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
                <>
                  <div className="full" style={{ display: 'grid', gap: '6px' }}>
                    <small style={{ color: '#475569' }}>
                      Quick templates (11th & 12th Streams — Arts, Commerce, Science):
                    </small>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {[
                        { name: 'Class 11 Science', grade: '11 Science' },
                        { name: 'Class 11 Commerce', grade: '11 Commerce' },
                        { name: 'Class 11 Arts', grade: '11 Arts' },
                        { name: 'Class 12 Science', grade: '12 Science' },
                        { name: 'Class 12 Commerce', grade: '12 Commerce' },
                        { name: 'Class 12 Arts', grade: '12 Arts' },
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() =>
                            setDraft({ ...draft, name: preset.name, grade: preset.grade })
                          }
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: draft.name === preset.name ? '#e7f1ef' : '#f8fafc',
                            color: '#182f49',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <details className="full">
                    <summary>Curriculum level (optional)</summary>
                    <label className="student-timing-field full">
                      Level used for subject suggestions
                      <input
                        maxLength={80}
                        value={draft.grade}
                        onChange={(e) => setDraft({ ...draft, grade: e.target.value })}
                        placeholder="For example, 11 Science, 12 Commerce, 12 Arts, or 6"
                      />
                    </label>
                  </details>
                </>
              ) : (
                <label className="student-timing-field full">
                  Class teacher
                  <select
                    disabled={!canAssignTeacher}
                    value={draft.teacherId}
                    onChange={(e) => setDraft({ ...draft, teacherId: e.target.value })}
                  >
                    <option value="">Not assigned</option>
                    {draft.teacherId && !teachers.some((t) => t.id === draft.teacherId) && (
                      <option value={draft.teacherId}>Assigned teacher</option>
                    )}
                    {teachers.map((t) => (
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
              <Button type="submit">Save {kind === 'class' ? 'Class' : 'section'}</Button>
            </div>
          </fieldset>
        </form>
      )}
    </Modal>
  );
}
