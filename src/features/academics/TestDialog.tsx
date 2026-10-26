import { useState, useRef } from 'react';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { useFeedback } from '../../app/useFeedback';
import { PickerInput, Button, Modal } from '../../components/ui/Primitives';
import { useSchoolFeature } from '../../app/schoolFeatureContext';
import { repository } from '../../lib/repository';
import { examSections } from '../../lib/academicSheets';
import { examClasses, examIncludes } from '../../lib/testScope';
import ClassName from '../../components/shared/ClassName';
import { orderedClasses, sectionLabel } from '../../lib/schoolLabels';
import type { Examination } from '../../types/domain';
import { useDraftGuard } from './useDraftGuard';
import { testKinds } from '../../lib/academics';
import { assessmentMaximum } from '../../lib/assessmentMaximums';
import { defaultTestSubjectIds, testSubjectChoices } from '../../lib/testSubjects';
import TestTypePicker from './TestTypePicker';

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
  const data = useSchoolFeature() ?? repository;
  const requestKey = useRef(crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState(exam?.kind || 'Daily test');
  const [defaultMaximum, setDefaultMaximum] = useState('');
  const [confirmedMaximum, setConfirmedMaximum] = useState(false);
  const [maximums, setMaximums] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      state.classes.flatMap((c) =>
        testSubjectChoices(state, exam, c.id).map((subject) => [
          `${c.id}:${subject.id}`,
          exam
            ? String(
                assessmentMaximum(state, exam, c.id, {
                  subjectId: subject.id,
                  name: subject.name,
                }) ?? '',
              )
            : '',
        ]),
      ),
    ),
  );
  const [name, setName] = useState(exam?.name ?? '');
  const [date, setDate] = useState(exam?.date ?? today);
  const classes = orderedClasses(state.classes.filter((c) => c.schoolId === state.school.id));
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    exam ? examClasses(state, exam).map((c) => c.id) : classId ? [classId] : [],
  );
  const [sections, setSections] = useState<string[]>(
    exam
      ? examSections(state, exam, '').map((s) => s.id)
      : state.sections.filter((s) => s.classId === classId).map((s) => s.id),
  );
  const [sectionless, setSectionless] = useState<string[]>(
    exam ? classes.filter((c) => examIncludes(exam, c.id, '')).map((c) => c.id) : [],
  );
  const [subjectIds, setSubjectIds] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      classes.map((schoolClass) => [
        schoolClass.id,
        defaultTestSubjectIds(state, exam, schoolClass.id),
      ]),
    ),
  );
  const toggleSubject = (classId: string, id: string, checked: boolean) =>
    setSubjectIds((current) => ({
      ...current,
      [classId]: checked
        ? [...new Set([...(current[classId] ?? []), id])]
        : current[classId].filter((subject) => subject !== id),
    }));
  const toggleClass = (id: string, checked: boolean) => {
    setSelectedClasses((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id),
    );
    if (checked)
      setSections((current) => [
        ...new Set([
          ...current,
          ...state.sections.filter((s) => s.classId === id).map((s) => s.id),
        ]),
      ]);
    if (!checked)
      setSections((current) =>
        current.filter((value) => !state.sections.some((s) => s.id === value && s.classId === id)),
      );
    if (!checked) setSectionless((current) => current.filter((value) => value !== id));
  };
  const [error, setError] = useState('');
  const value = JSON.stringify([
    name,
    date,
    kind,
    selectedClasses,
    sections,
    sectionless,
    subjectIds,
    maximums,
  ]);
  const [initial] = useState(value);
  const guard = useDraftGuard(value !== initial, onClose);
  const maximumChanged = Boolean(
    exam &&
    state.results.some((r) => r.examId === exam.id) &&
    selectedClasses.some((id) =>
      (subjectIds[id] ?? []).some((subjectId) => {
        const subject = testSubjectChoices(state, exam, id).find((v) => v.id === subjectId)!;
        return (
          Number(maximums[`${id}:${subjectId}`] || defaultMaximum) !==
          assessmentMaximum(state, exam, id, { subjectId, name: subject.name })
        );
      }),
    ),
  );
  const kindChoices = [
    ...new Set([...testKinds, ...state.exams.map((e) => e.kind).filter(Boolean)]),
  ];
  return (
    <Modal
      wide={!guard.confirming}
      open
      onClose={guard.confirming ? guard.keepEditing : guard.requestClose}
      title={
        guard.confirming ? 'Discard test changes?' : exam ? 'Edit Test / Exam' : 'Add Test / Exam'
      }
      description={
        guard.confirming
          ? 'Your test details have not been saved.'
          : 'Choose the assessment, classes and subjects. Maximum marks apply across all selected sections.'
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
          className="academic-test-form"
          onChange={() => {
            if (error) setError('');
          }}
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving) return;
            setSaving(true);
            try {
              if (maximumChanged && !confirmedMaximum)
                throw new Error(
                  'Confirm the maximum marks change after reviewing its effect on existing results.',
                );
              const input = {
                kind,
                subjectMaximums: selectedClasses.flatMap((id) =>
                  (subjectIds[id] ?? []).map((subjectId) => ({
                    classId: id,
                    subjectId,
                    maxMarks: Number(maximums[`${id}:${subjectId}`] || defaultMaximum),
                  })),
                ),
                requestKey: requestKey.current,
                name,
                date,
                subjectSelections: selectedClasses.map((id) => ({
                  classId: id,
                  subjectIds: subjectIds[id] ?? [],
                })),
                classId: selectedClasses.length === 1 ? selectedClasses[0] : '',
                classIds: classes.filter((c) => selectedClasses.includes(c.id)).map((c) => c.id),
                sectionIds: sections,
                sectionlessClassIds: selectedClasses.filter(
                  (id) =>
                    sectionless.includes(id) ||
                    !state.sections.some((s) => s.schoolId === state.school.id && s.classId === id),
                ),
                sectionId: '',
              };
              const id = exam?.id ?? '';
              if (exam) await data.updateTest(id, input);
              const savedId = exam ? id : await data.createTest(input);
              notify(
                exam ? 'Test details updated.' : 'Test created. Open its pencil to add marks.',
              );
              guard.complete(() => onCreated(savedId));
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Unable to save this test.');
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="academic-test-details">
            <label className="field">
              Academic year
              <input value={state.academicYear.name} readOnly />
            </label>
            <TestTypePicker
              value={kind}
              options={kindChoices}
              onChange={setKind}
              disabled={saving}
            />
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
          {!exam && (
            <label className="field">
              Maximum marks for selected subjects
              <input
                aria-label="Default maximum marks"
                type="number"
                min="0.000001"
                max="10000"
                step="any"
                value={defaultMaximum}
                onChange={(e) => {
                  setDefaultMaximum(e.target.value);
                  setMaximums((current) =>
                    Object.fromEntries(
                      Object.entries(current).map(([key]) => [key, e.target.value]),
                    ),
                  );
                }}
              />
              <small>You can adjust individual subject maximums below.</small>
            </label>
          )}
          <label className="field">
            Add a class
            <select
              aria-label="Add assessment class"
              value=""
              onChange={(e) => {
                if (e.target.value) toggleClass(e.target.value, true);
              }}
            >
              <option value="">Select a class…</option>
              {classes
                .filter((c) => !selectedClasses.includes(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <fieldset className="academic-class-choices">
            <legend>Classes, sections &amp; subjects</legend>
            <p>
              Select classes and subjects. Sections are optional; include students without a section
              when needed.
            </p>
            <div className="academic-class-grid">
              {classes
                .filter((c) => selectedClasses.includes(c.id))
                .map((schoolClass) => {
                  const selected = selectedClasses.includes(schoolClass.id);
                  const availableSubjects = testSubjectChoices(state, exam, schoolClass.id);
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
                        <strong>
                          <ClassName name={schoolClass.name} />
                        </strong>
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
                            <p>Whole class · no sections needed.</p>
                          )}
                          {choices.length > 0 && (
                            <label>
                              <input
                                type="checkbox"
                                aria-label={`${schoolClass.name} without section`}
                                checked={sectionless.includes(schoolClass.id)}
                                onChange={(e) =>
                                  setSectionless((current) =>
                                    e.target.checked
                                      ? [...current, schoolClass.id]
                                      : current.filter((id) => id !== schoolClass.id),
                                  )
                                }
                              />
                              Without section
                            </label>
                          )}
                        </div>
                      )}
                      {selected && (
                        <fieldset className="academic-class-subjects">
                          <legend>Subjects</legend>
                          <label className="academic-all-subjects">
                            <input
                              type="checkbox"
                              aria-label={`All subjects for ${schoolClass.name}`}
                              checked={
                                availableSubjects.length > 0 &&
                                availableSubjects.every((subject) =>
                                  subjectIds[schoolClass.id]?.includes(subject.id),
                                )
                              }
                              onChange={(event) =>
                                setSubjectIds((current) => ({
                                  ...current,
                                  [schoolClass.id]: event.target.checked
                                    ? availableSubjects.map((subject) => subject.id)
                                    : [],
                                }))
                              }
                            />
                            All subjects
                          </label>
                          <div>
                            {availableSubjects.map((subject) => (
                              <label key={subject.id}>
                                <input
                                  type="checkbox"
                                  aria-label={`${schoolClass.name} subject ${subject.name}`}
                                  checked={
                                    subjectIds[schoolClass.id]?.includes(subject.id) ?? false
                                  }
                                  onChange={(event) =>
                                    toggleSubject(schoolClass.id, subject.id, event.target.checked)
                                  }
                                />
                                {subject.name}
                                {subjectIds[schoolClass.id]?.includes(subject.id) && (
                                  <span className="assessment-maximum-field">
                                    Max
                                    <input
                                      required
                                      type="number"
                                      min="0.000001"
                                      max="10000"
                                      step="any"
                                      aria-label={`${schoolClass.name} ${subject.name} maximum marks`}
                                      value={
                                        maximums[`${schoolClass.id}:${subject.id}`] ||
                                        defaultMaximum
                                      }
                                      onChange={(e) => {
                                        setConfirmedMaximum(false);
                                        setMaximums((current) => ({
                                          ...current,
                                          [`${schoolClass.id}:${subject.id}`]: e.target.value,
                                        }));
                                      }}
                                    />
                                  </span>
                                )}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      )}
                    </div>
                  );
                })}
            </div>
          </fieldset>
          {maximumChanged && (
            <label className="live-check assessment-maximum-confirm">
              <input
                type="checkbox"
                checked={confirmedMaximum}
                onChange={(e) => setConfirmedMaximum(e.target.checked)}
              />
              Apply these maximums to every section and revalidate existing marks. Marks stay
              unchanged; percentages will be recalculated. A maximum below a saved score is
              rejected.
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : exam ? 'Save test' : 'Create Test'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
