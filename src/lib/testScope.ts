import type { DemoState, Examination } from '../types/domain';
import { orderedClasses } from './schoolLabels';

export function examIncludes(exam: Examination, classId: string, sectionId?: string) {
  return (
    (exam.classIds ? exam.classIds.includes(classId) : !exam.classId || exam.classId === classId) &&
    (!sectionId ||
      (exam.sectionIds
        ? exam.sectionIds.includes(sectionId)
        : !exam.sectionId || exam.sectionId === sectionId))
  );
}

export function examClasses(state: DemoState, exam: Examination) {
  return orderedClasses(
    state.classes.filter(
      (c) =>
        c.schoolId === state.school.id &&
        examIncludes(exam, c.id) &&
        state.sections.some(
          (s) =>
            s.schoolId === state.school.id && s.classId === c.id && examIncludes(exam, c.id, s.id),
        ),
    ),
  );
}

export function validateTestScope(state: DemoState, exam: Examination, creating: boolean) {
  if (exam.classIds) {
    if (
      !exam.classIds.length ||
      new Set(exam.classIds).size !== exam.classIds.length ||
      exam.classIds.some(
        (id) => !state.classes.some((c) => c.schoolId === state.school.id && c.id === id),
      )
    )
      throw new Error('Choose at least one class from this school.');
    if (
      !exam.sectionIds?.length ||
      new Set(exam.sectionIds).size !== exam.sectionIds.length ||
      exam.sectionIds.some(
        (id) =>
          !state.sections.some(
            (s) =>
              s.schoolId === state.school.id && s.id === id && exam.classIds!.includes(s.classId),
          ),
      )
    )
      throw new Error('Choose sections belonging to the selected classes.');
    for (const id of exam.classIds) {
      if (
        !state.sections.some(
          (s) =>
            s.schoolId === state.school.id && s.classId === id && exam.sectionIds!.includes(s.id),
        )
      )
        throw new Error(
          `Choose at least one section for ${state.classes.find((c) => c.id === id)?.name}.`,
        );
    }
    return;
  }
  if (
    (creating || exam.classId) &&
    !state.classes.some((c) => c.schoolId === state.school.id && c.id === exam.classId)
  )
    throw new Error('Choose a class for this test.');
  if (
    exam.sectionIds &&
    (!exam.sectionIds.length ||
      new Set(exam.sectionIds).size !== exam.sectionIds.length ||
      exam.sectionIds.some(
        (id) =>
          !state.sections.some(
            (s) =>
              s.schoolId === state.school.id &&
              s.id === id &&
              (!exam.classId || s.classId === exam.classId),
          ),
      ))
  )
    throw new Error('Choose at least one section from this class.');
  if (
    exam.sectionId &&
    !state.sections.some(
      (s) =>
        s.schoolId === state.school.id &&
        s.id === exam.sectionId &&
        (!exam.classId || s.classId === exam.classId),
    )
  )
    throw new Error('Choose a section in this class.');
}
