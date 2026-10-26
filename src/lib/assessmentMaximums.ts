import type { DemoState, Examination, TestSubject } from '../types/domain';
import { testSubjectChoices, isTestSubjectSelected } from './testSubjects';

export function assessmentMaximum(
  state: DemoState,
  exam: Examination,
  classId: string,
  subject: Pick<TestSubject, 'subjectId' | 'name'>,
) {
  const declared = exam.subjectMaximums?.find(
    (m) => m.classId === classId && m.subjectId === subject.subjectId,
  );
  if (declared) return declared.maxMarks;
  const saved = (exam.sheets ?? [])
    .filter(
      (s) =>
        (s.classId ??
          state.sections.find((section) => section.id === s.sectionId)?.classId ??
          exam.classId) === classId,
    )
    .flatMap((s) => s.subjects);
  const values = [
    ...new Set(
      [...saved, ...exam.subjects]
        .filter((s) =>
          subject.subjectId && s.subjectId
            ? s.subjectId === subject.subjectId
            : s.name === subject.name,
        )
        .map((s) => s.maxMarks),
    ),
  ];
  // Conflicting historical maxima stay untouched until explicitly reconciled in Edit Test.
  return values.length === 1 ? values[0] : undefined;
}

export function validateMaximums(state: DemoState, exam: Examination, complete = false) {
  if (!exam.subjectMaximums) return;
  const values = exam.subjectMaximums;
  if (
    new Set(values.map((m) => `${m.classId}:${m.subjectId}`)).size !== values.length ||
    values.some(
      (m) =>
        !Number.isFinite(m.maxMarks) ||
        m.maxMarks <= 0 ||
        m.maxMarks > 10000 ||
        !testSubjectChoices(state, exam, m.classId).some((s) => s.id === m.subjectId) ||
        !isTestSubjectSelected(state, exam, m.classId, { subjectId: m.subjectId, name: '' }) ||
        !state.classes.some((c) => c.schoolId === state.school.id && c.id === m.classId),
    )
  )
    throw new Error('Choose valid assessment maximum marks for the selected class subjects.');
  if (
    complete &&
    exam.subjectSelections &&
    exam.subjectSelections.reduce((n, s) => n + s.subjectIds.length, 0) !== values.length
  )
    throw new Error('Enter maximum marks for every selected subject.');
}

export function reconcileMaximums(state: DemoState, exam: Examination): DemoState {
  if (!exam.subjectMaximums) return state;
  const maximum = (classId: string, subject: TestSubject) =>
    exam.subjectMaximums!.find((m) => m.classId === classId && m.subjectId === subject.subjectId)
      ?.maxMarks;
  return {
    ...state,
    exams: state.exams.map((e) =>
      e.id !== exam.id
        ? e
        : {
            ...e,
            sheets: e.sheets?.map((sheet) => ({
              ...sheet,
              subjects: sheet.subjects.map((s) => ({
                ...s,
                maxMarks:
                  maximum(
                    sheet.classId ??
                      state.sections.find((v) => v.id === sheet.sectionId)?.classId ??
                      e.classId,
                    s,
                  ) ?? s.maxMarks,
              })),
            })),
          },
    ),
    results: state.results.map((r) => {
      if (r.schoolId !== state.school.id || r.examId !== exam.id) return r;
      const classId = state.enrollments.find((e) => e.id === r.enrollmentId)?.classId ?? '';
      return {
        ...r,
        subjects: r.subjects.map((s) => {
          const max = maximum(classId, s);
          if (max === undefined) return s;
          if (!r.absent && !s.absent && !s.pending && s.marks > max)
            throw new Error(
              'The new maximum is lower than marks already recorded. Correct those marks first; scores are never rescaled.',
            );
          return { ...s, maxMarks: max };
        }),
      };
    }),
  };
}
