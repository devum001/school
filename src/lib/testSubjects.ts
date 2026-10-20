import { classSubjects, subjectName } from './classSubjects';
import { examIncludes } from './testScope';
import type { ClassSubject, DemoState, Examination, TestSubject } from '../types/domain';

type SubjectIdentity = Pick<TestSubject, 'subjectId' | 'name'>;

function storedSubjects(state: DemoState, exam: Examination, classId: string): SubjectIdentity[] {
  const sections = new Set(
    state.sections
      .filter((section) => section.schoolId === state.school.id && section.classId === classId)
      .map((section) => section.id),
  );
  const enrollments = new Set(
    state.enrollments
      .filter(
        (enrollment) => enrollment.schoolId === state.school.id && enrollment.classId === classId,
      )
      .map((enrollment) => enrollment.id),
  );
  return [
    ...exam.subjects,
    ...(exam.sheets ?? [])
      .filter((sheet) => sheet.classId === classId || sections.has(sheet.sectionId))
      .flatMap((sheet) => sheet.subjects),
    ...state.results
      .filter(
        (result) =>
          result.schoolId === state.school.id &&
          result.examId === exam.id &&
          enrollments.has(result.enrollmentId),
      )
      .flatMap((result) => result.subjects),
  ];
}

export function testSubjectChoices(
  state: DemoState,
  exam: Examination | undefined,
  classId: string,
): ClassSubject[] {
  const stored = exam && examIncludes(exam, classId) ? storedSubjects(state, exam, classId) : [];
  const assigned =
    exam?.subjectSelections?.find((selection) => selection.classId === classId)?.subjectIds ?? [];
  const choices = classSubjects(state, classId).filter(
    (subject) =>
      !subject.archived ||
      assigned.includes(subject.id) ||
      stored.some(
        (saved) =>
          saved.subjectId === subject.id || subjectName(state, classId, saved) === subject.name,
      ),
  );
  for (const subject of stored) {
    const name = subjectName(state, classId, subject);
    if (!choices.some((choice) => choice.id === subject.subjectId || choice.name === name))
      choices.push({ id: subject.subjectId ?? `${classId}:legacy:${subject.name}`, name });
  }
  return choices;
}

export function defaultTestSubjectIds(
  state: DemoState,
  exam: Examination | undefined,
  classId: string,
): string[] {
  const choices = testSubjectChoices(state, exam, classId);
  const selected = exam?.subjectSelections?.find((selection) => selection.classId === classId);
  if (selected) return [...selected.subjectIds];
  const stored = exam && examIncludes(exam, classId) ? storedSubjects(state, exam, classId) : [];
  return choices
    .filter((choice) =>
      stored.length
        ? stored.some(
            (subject) =>
              subject.subjectId === choice.id ||
              subjectName(state, classId, subject) === choice.name,
          )
        : !choice.archived,
    )
    .map((choice) => choice.id);
}

export function isTestSubjectSelected(
  state: DemoState,
  exam: Examination,
  classId: string,
  subject: SubjectIdentity,
): boolean {
  if (!exam.subjectSelections) return true;
  const selection = exam.subjectSelections.find((item) => item.classId === classId);
  if (!selection) return false;
  if (subject.subjectId && selection.subjectIds.includes(subject.subjectId)) return true;
  const name = subjectName(state, classId, subject);
  const configured = classSubjects(state, classId).find((item) => item.name === name);
  return selection.subjectIds.includes(configured?.id ?? `${classId}:legacy:${subject.name}`);
}

export function validateTestSubjects(state: DemoState, exam: Examination): void {
  if (!exam.subjectSelections) return;
  const classes = state.classes.filter(
    (schoolClass) => schoolClass.schoolId === state.school.id && examIncludes(exam, schoolClass.id),
  );
  if (
    exam.subjectSelections.length !== classes.length ||
    new Set(exam.subjectSelections.map((item) => item.classId)).size !== classes.length
  )
    throw new Error('Choose subjects for every selected class.');
  for (const selection of exam.subjectSelections) {
    const schoolClass = classes.find((item) => item.id === selection.classId);
    if (!schoolClass) throw new Error('Choose subjects only for the selected classes.');
    const available = testSubjectChoices(state, exam, schoolClass.id);
    if (
      !selection.subjectIds.length ||
      new Set(selection.subjectIds).size !== selection.subjectIds.length ||
      selection.subjectIds.some((id) => !available.some((subject) => subject.id === id))
    )
      throw new Error(`Choose at least one valid subject for ${schoolClass.name}.`);
  }
}
