import type { DemoState, Examination } from '../types/domain';
import { examClasses, examIncludes } from './testScope';
import { sectionLabel } from './schoolLabels';

/** A marks sheet is scoped by class AND section; no synthetic sections are persisted. */
export function examGroups(state: DemoState, exam: Examination, classId?: string) {
  return examClasses(state, exam)
    .filter((c) => !classId || c.id === classId)
    .flatMap((c) => {
      const sections = state.sections.filter(
        (s) => s.schoolId === state.school.id && s.classId === c.id,
      );
      const groups = sections
        .filter((s) => examIncludes(exam, c.id, s.id))
        .map((s) => ({
          key: s.id,
          classId: c.id,
          sectionId: s.id,
          label: sectionLabel(s.name),
        }));
      if (
        examIncludes(exam, c.id, '') &&
        (!sections.length ||
          exam.sectionlessClassIds?.includes(c.id) ||
          state.enrollments.some(
            (e) =>
              e.schoolId === state.school.id &&
              e.academicYearId === state.academicYear.id &&
              e.classId === c.id &&
              !e.sectionId,
          ))
      ) {
        groups.push({
          key: JSON.stringify([c.id, '']),
          classId: c.id,
          sectionId: '',
          label: 'Without section',
        });
      }
      return groups;
    });
}

/** undefined means the whole class; an empty string means only sectionless students. */
export function matchesAcademicScope(
  enrollment: { classId: string; sectionId: string },
  classId?: string,
  sectionId?: string,
) {
  return (
    (!classId || enrollment.classId === classId) &&
    (sectionId === undefined || enrollment.sectionId === sectionId)
  );
}
