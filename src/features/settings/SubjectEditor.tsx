import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useFeedback } from '../../app/useFeedback';
import { AppIcon, Button, Modal, Panel } from '../../components/ui/Primitives';
import {
  boardSubjectCatalogForClass,
  detectClassStream,
  type AcademicStream,
} from '../../lib/classSubjects';
import type { ClassSubject } from '../../types/domain';
import { useDraftGuard } from '../academics/useDraftGuard';

type EditableSubject = ClassSubject & { optional?: boolean };
type PresetKey = 'auto' | AcademicStream | '9-10' | '6-8' | '1-5';

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
  const detectedStream = detectClassStream(name);
  const grade = Number(name.match(/\d+/)?.[0] ?? 0);
  const isSenior = grade === 11 || grade === 12 || Boolean(detectedStream);
  const [preset, setPreset] = useState<PresetKey>(detectedStream ?? 'auto');

  useEffect(() => {
    onDirtyChange?.(JSON.stringify(subjects) !== initial);
  }, [subjects, initial, onDirtyChange]);
  const guard = useDraftGuard(JSON.stringify(subjects) !== initial, () =>
    setSubjects(initial ? JSON.parse(initial) : configured.filter((s) => !s.archived)),
  );

  const recommendedSubjects =
    preset === 'science' || preset === 'commerce' || preset === 'arts'
      ? boardSubjectCatalogForClass(name, preset)
      : preset === '9-10'
        ? boardSubjectCatalogForClass('Class 10')
        : preset === '6-8'
          ? boardSubjectCatalogForClass('Class 8')
          : preset === '1-5'
            ? boardSubjectCatalogForClass('Class 5')
            : boardSubjectCatalogForClass(name);

  const existingKeys = new Set(subjects.map((s) => s.name.trim().toLowerCase()));
  const missingRecommended = recommendedSubjects.filter(
    (item) => !existingKeys.has(item.trim().toLowerCase()),
  );

  function addSubjectByName(subjectName: string) {
    if (existingKeys.has(subjectName.trim().toLowerCase())) return;
    if (subjects.length >= 30) {
      setError('Add up to 30 subjects per class.');
      return;
    }
    setError('');
    setSubjects((prev) => [...prev, { id: crypto.randomUUID(), name: subjectName }]);
  }

  function addAllRecommended() {
    if (!missingRecommended.length) return;
    const availableSlots = Math.max(0, 30 - subjects.length);
    const toAdd = missingRecommended.slice(0, availableSlots);
    if (!toAdd.length) {
      setError('Add up to 30 subjects per class.');
      return;
    }
    setError('');
    setSubjects((prev) => [
      ...prev,
      ...toAdd.map((subjectName) => ({ id: crypto.randomUUID(), name: subjectName })),
    ]);
  }

  return (
    <Panel title={`Subjects — ${name}`}>
      <fieldset
        data-unsaved={JSON.stringify(subjects) !== initial}
        disabled={busy || !canManage}
        className="class-subject-settings"
        style={{ border: 0 }}
      >
        {canManage && (
          <div
            style={{
              padding: '14px 16px',
              marginBottom: '16px',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'grid',
              gap: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <div>
                <strong style={{ display: 'block', fontSize: '0.92rem', color: '#0f1f2e' }}>
                  RBSE & CBSE Curriculum Subjects ({isSenior ? 'Class 11–12 Streams' : 'Class 1–12'})
                </strong>
                <small style={{ color: '#475569' }}>
                  Quickly add standard RBSE / CBSE subjects or stream-specific subjects for Arts,
                  Commerce, and Science.
                </small>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <select
                  aria-label="RBSE CBSE curriculum preset"
                  value={preset}
                  onChange={(e) => setPreset(e.target.value as PresetKey)}
                  style={{ minHeight: '36px', padding: '6px 10px', fontSize: '0.875rem' }}
                >
                  <option value="auto">Recommended for {name}</option>
                  <option value="science">11th–12th Science (PCM / PCB)</option>
                  <option value="commerce">11th–12th Commerce</option>
                  <option value="arts">11th–12th Arts / Humanities</option>
                  <option value="9-10">Class 9–10 (RBSE / CBSE)</option>
                  <option value="6-8">Class 6–8 (Upper Primary)</option>
                  <option value="1-5">Class 1–5 (Primary)</option>
                </select>
                {missingRecommended.length > 0 && (
                  <Button type="button" variant="secondary" onClick={addAllRecommended}>
                    <Plus size={14} />
                    Add all ({missingRecommended.length})
                  </Button>
                )}
              </div>
            </div>
            {missingRecommended.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {missingRecommended.map((subjectName) => (
                  <button
                    key={subjectName}
                    type="button"
                    onClick={() => addSubjectByName(subjectName)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#182f49',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    + {subjectName}
                  </button>
                ))}
              </div>
            ) : (
              <small style={{ color: '#15803d', fontWeight: 500 }}>
                All recommended RBSE / CBSE subjects for this preset are included below.
              </small>
            )}
          </div>
        )}
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
