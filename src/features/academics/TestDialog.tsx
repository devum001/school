import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { useFeedback } from '../../app/useFeedback';
import { PickerInput, Button, Modal } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import { examSections } from '../../lib/academicSheets';
import { examClasses } from '../../lib/testScope';
import { orderedClasses, sectionLabel } from '../../lib/schoolLabels';
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
  const state = useSchool(),
    today = useToday(),
    notify = useFeedback();
  const [name, setName] = useState(exam?.name ?? '');
  const [kind, setKind] = useState(exam?.kind ?? '');
  const [date, setDate] = useState(exam?.date ?? today);
  const classes = orderedClasses(state.classes.filter((c) => c.schoolId === state.school.id));
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    exam ? examClasses(state, exam).map((c) => c.id) : classId ? [classId] : [],
  );
  const [sections, setSections] = useState<string[]>(
    exam ? examSections(state, exam, '').map((s) => s.id) : [],
  );
  const toggleClass = (id: string, checked: boolean) => {
    setSelectedClasses((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id),
    );
    if (!checked)
      setSections((current) =>
        current.filter((value) => !state.sections.some((s) => s.id === value && s.classId === id)),
      );
  };
  const [error, setError] = useState('');
  const value = JSON.stringify([name, kind, date, selectedClasses, sections]);
  const [initial] = useState(value);
  const guard = useDraftGuard(value !== initial, onClose);
  return (
    <Modal
      open
      onClose={guard.confirming ? guard.keepEditing : guard.requestClose}
      title={
        guard.confirming ? 'Discard test changes?' : exam ? 'Edit Test / Exam' : 'Add Test / Exam'
      }
      description={
        guard.confirming
          ? 'Your test details have not been saved.'
          : 'Set up the test here. Enter maximum marks and student marks in its marks sheet.'
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
          onChange={() => {
            if (error) setError('');
          }}
          onSubmit={(event) => {
            event.preventDefault();
            try {
              const input = {
                name,
                kind,
                date,
                classId: selectedClasses.length === 1 ? selectedClasses[0] : '',
                classIds: classes.filter((c) => selectedClasses.includes(c.id)).map((c) => c.id),
                sectionIds: sections,
                sectionId: '',
              };
              const id = exam?.id ?? '';
              if (exam) repository.updateTest(id, input);
              const savedId = exam ? id : repository.createTest(input);
              notify(
                exam ? 'Test details updated.' : 'Test created. Open its pencil to add marks.',
              );
              guard.complete(() => onCreated(savedId));
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Unable to save this test.');
            }
          }}
        >
          <label className="field">
            Test name
            <input
              required
              maxLength={100}
              value={name}
              placeholder="e.g. Daily Practice"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              Test type
              <input
                required
                maxLength={60}
                value={kind}
                placeholder="e.g. Weekly Practice"
                onChange={(e) => setKind(e.target.value)}
              />
            </label>
            <label className="field">
              Test date
              <PickerInput
                required
                type="date"
                min={state.academicYear.start}
                max={state.academicYear.end < today ? state.academicYear.end : today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          <fieldset className="academic-class-choices">
            <legend>Classes &amp; sections</legend>
            <p>Select one or more classes, then choose their sections.</p>
            {classes.map((schoolClass) => {
              const selected = selectedClasses.includes(schoolClass.id);
              const choices = state.sections.filter(
                (s) => s.schoolId === state.school.id && s.classId === schoolClass.id,
              );
              return (
                <div
                  className={`academic-class-choice ${selected ? 'selected' : ''}`}
                  key={schoolClass.id}
                >
                  <label className="academic-class-check">
                    <input
                      type="checkbox"
                      aria-label={`Select ${schoolClass.name}`}
                      checked={selected}
                      onChange={(e) => toggleClass(schoolClass.id, e.target.checked)}
                    />
                    <strong>{schoolClass.name}</strong>
                    <small>
                      {selected
                        ? `${choices.filter((s) => sections.includes(s.id)).length} / ${choices.length} sections selected`
                        : `${choices.length} sections`}
                    </small>
                  </label>
                  {selected && (
                    <div className="academic-class-sections">
                      {choices.length ? (
                        <>
                          <label className="academic-all-sections">
                            <input
                              type="checkbox"
                              aria-label={`All sections for ${schoolClass.name}`}
                              checked={choices.every((s) => sections.includes(s.id))}
                              onChange={(e) =>
                                setSections((current) =>
                                  e.target.checked
                                    ? [...new Set([...current, ...choices.map((s) => s.id)])]
                                    : current.filter((id) => !choices.some((s) => s.id === id)),
                                )
                              }
                            />
                            All sections
                          </label>
                          {choices.map((section) => (
                            <label key={section.id}>
                              <input
                                type="checkbox"
                                aria-label={`${schoolClass.name} ${sectionLabel(section.name)}`}
                                checked={sections.includes(section.id)}
                                onChange={(e) =>
                                  setSections((current) =>
                                    e.target.checked
                                      ? [...current, section.id]
                                      : current.filter((id) => id !== section.id),
                                  )
                                }
                              />
                              {sectionLabel(section.name)}
                            </label>
                          ))}
                        </>
                      ) : (
                        <p>Add sections for this class in School Settings first.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </fieldset>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button type="submit">{exam ? 'Save test' : 'Create Test'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
