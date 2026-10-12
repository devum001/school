import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import { testKinds } from '../../lib/academics';
import type { Examination } from '../../types/domain';
import { useDraftGuard } from './useDraftGuard';
export default function TestDialog({
  classId,
  exam,
  onClose,
  onCreated,
}: {
  classId: string;
  exam?: Examination;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const state = useSchool();
  const today = useToday();
  const notify = useFeedback();
  const [name, setName] = useState(exam?.name ?? '');
  const [kind, setKind] = useState<Examination['kind']>(exam?.kind ?? 'Daily test');
  const [date, setDate] = useState(exam?.date ?? today);
  const [schoolClass, setClass] = useState(exam?.classId ?? classId);
  const [section, setSection] = useState(exam?.sectionId ?? '');
  const [subjects, setSubjects] = useState(
    exam?.subjects.map((s) => ({ name: s.name, maxMarks: String(s.maxMarks) })) ?? [
      { name: '', maxMarks: '20' },
    ],
  );
  const [error, setError] = useState('');
  const [initial] = useState(() =>
    JSON.stringify([name, kind, date, schoolClass, section, subjects]),
  );
  const locked = Boolean(exam && state.results.some((r) => r.examId === exam.id));
  const guard = useDraftGuard(
    initial !== JSON.stringify([name, kind, date, schoolClass, section, subjects]),
    onClose,
  );
  const changeSubject = (index: number, key: 'name' | 'maxMarks', value: string) =>
    setSubjects(subjects.map((s, i) => (i === index ? { ...s, [key]: value } : s)));
  return (
    <Modal
      open
      wide
      onClose={guard.confirming ? guard.keepEditing : guard.requestClose}
      title={guard.confirming ? 'Discard test changes?' : exam ? 'Edit test' : 'Add a test'}
      description={
        guard.confirming
          ? 'Your test details have not been saved.'
          : 'Choose the class, date and maximum marks. Add student marks next.'
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
              const input = {
                name,
                kind,
                date,
                classId: schoolClass,
                sectionId: section,
                subjects: subjects.map((s) => ({ name: s.name, maxMarks: Number(s.maxMarks) })),
              };
              if (exam) {
                repository.updateTest(exam.id, input);
                notify('Test updated. Percentages and rankings recalculated.');
                onCreated(exam.id);
              } else {
                const id = repository.createTest(input);
                notify('Test added. You can now enter marks.');
                onCreated(id);
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unable to add this test.');
            }
          }}
        >
          <label className="field">
            Test name
            <input
              required
              maxLength={100}
              placeholder="e.g. Mathematics · Chapter 4"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              Test type
              <select
                aria-label="Test type"
                value={kind}
                onChange={(e) => setKind(e.target.value as Examination['kind'])}
              >
                {testKinds.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Test date
              <input
                required
                type="date"
                min={state.academicYear.start}
                max={today < state.academicYear.end ? today : state.academicYear.end}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="field">
              Test class
              <select
                aria-label="Test class"
                disabled={locked}
                value={schoolClass}
                onChange={(e) => {
                  setClass(e.target.value);
                  setSection('');
                }}
              >
                {exam && !exam.classId && <option value="">All classes</option>}
                {state.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Test section
              <select
                aria-label="Test section"
                disabled={locked}
                value={section}
                onChange={(e) => setSection(e.target.value)}
              >
                <option value="">All sections</option>
                {state.sections
                  .filter((s) => s.classId === schoolClass)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      Section {s.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="test-subject-heading">
            <h3>Subjects & maximum marks</h3>
            <span>Total: {subjects.reduce((n, s) => n + (Number(s.maxMarks) || 0), 0)} marks</span>
          </div>
          <p className="panel-note">
            {locked
              ? 'This test has recorded marks. Class, section and subject count are fixed. Subject names and maximums can be corrected; maximums must cover all saved scores.'
              : 'Use one subject for a daily test, or add several for an examination.'}
          </p>
          {subjects.map((s, i) => (
            <div className="test-subject-row" key={i}>
              <label className="field">
                Subject {i + 1}
                <input
                  required
                  maxLength={60}
                  placeholder="e.g. Mathematics"
                  value={s.name}
                  onChange={(e) => changeSubject(i, 'name', e.target.value)}
                />
              </label>
              <label className="field">
                Maximum marks {i + 1}
                <input
                  required
                  type="number"
                  min="0.5"
                  max="10000"
                  step="0.5"
                  value={s.maxMarks}
                  onChange={(e) => changeSubject(i, 'maxMarks', e.target.value)}
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                aria-label={`Remove subject ${i + 1}`}
                disabled={locked || subjects.length === 1}
                onClick={() => setSubjects(subjects.filter((_, j) => i !== j))}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={locked || subjects.length >= 12}
            onClick={() => setSubjects([...subjects, { name: '', maxMarks: '100' }])}
          >
            <Plus size={15} />
            Add subject
          </Button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button type="submit">{exam ? 'Save test' : 'Create test'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
