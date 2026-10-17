import { classSubjectSchema } from './classSubjects';
import { z } from 'zod';
import type { DemoState, SchoolClass, Section } from '../types/domain';

const name = z.string().trim().min(1, 'Enter a name.').max(80);
export const schoolClassSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  name,
  grade: z.string().trim().max(80).optional(),
  subjects: z.array(classSubjectSchema).optional(),
});
export type ClassInput = Pick<SchoolClass, 'name' | 'grade'>;
export type SectionInput = Pick<Section, 'classId' | 'name' | 'teacherId'>;
export function saveSchoolClass(state: DemoState, input: ClassInput, id?: string): DemoState {
  const item = schoolClassSchema.parse({
    ...(id ? state.classes.find((c) => c.id === id) : {}),
    ...input,
    id: id ?? crypto.randomUUID(),
    schoolId: state.school.id,
  });
  if (id && !state.classes.some((c) => c.id === id && c.schoolId === state.school.id))
    throw new Error('Class not found.');
  if (
    state.classes.some(
      (c) =>
        c.schoolId === state.school.id &&
        c.id !== id &&
        c.name.toLowerCase() === item.name.toLowerCase(),
    )
  )
    throw new Error('A class with this name already exists.');
  return {
    ...state,
    classes: id
      ? state.classes.map((c) => (c.id === id && c.schoolId === state.school.id ? item : c))
      : [...state.classes, item],
  };
}
export function saveSchoolSection(state: DemoState, input: SectionInput, id?: string): DemoState {
  const parsed = z.object({ classId: z.string(), name, teacherId: z.string() }).parse(input);
  const existing = state.sections.find((s) => s.id === id && s.schoolId === state.school.id);
  if (id && !existing) throw new Error('Section not found.');
  if (existing && existing.classId !== parsed.classId)
    throw new Error('A section must stay in its existing class.');
  if (!state.classes.some((c) => c.id === parsed.classId && c.schoolId === state.school.id))
    throw new Error('Choose a class from this school.');
  if (
    parsed.teacherId &&
    !state.teachers.some(
      (t) =>
        t.id === parsed.teacherId &&
        t.schoolId === state.school.id &&
        (t.status === 'active' || t.id === existing?.teacherId),
    )
  )
    throw new Error('Choose an active teacher from this school.');
  if (
    state.sections.some(
      (s) =>
        s.schoolId === state.school.id &&
        s.classId === parsed.classId &&
        s.id !== id &&
        s.name.toLowerCase() === parsed.name.toLowerCase(),
    )
  )
    throw new Error('This section name already exists in the class.');
  const next: Section = { ...parsed, id: id ?? crypto.randomUUID(), schoolId: state.school.id };
  return {
    ...state,
    sections: id
      ? state.sections.map((s) => (s.id === id && s.schoolId === state.school.id ? next : s))
      : [...state.sections, next],
  };
}
export function deleteSchoolSection(state: DemoState, id: string): DemoState {
  if (!state.sections.some((s) => s.id === id && s.schoolId === state.school.id))
    throw new Error('Section not found.');
  if (state.sections.filter((s) => s.schoolId === state.school.id).length <= 1)
    throw new Error('Keep at least one school section.');
  if (
    state.enrollments.some((e) => e.schoolId === state.school.id && e.sectionId === id) ||
    state.exams.some(
      (e) => e.schoolId === state.school.id && (e.sectionId === id || e.sectionIds?.includes(id)),
    ) ||
    state.studentTimings?.some(
      (t) => t.schoolId === state.school.id && t.sectionIds.includes(id),
    ) ||
    state.classTimetables?.some((t) => t.schoolId === state.school.id && t.sectionId === id)
  )
    throw new Error(
      'This section has students, exam records or timing assignments. Keep it to preserve those records.',
    );
  return {
    ...state,
    sections: state.sections.filter((s) => s.schoolId !== state.school.id || s.id !== id),
  };
}
export function deleteSchoolClass(state: DemoState, id: string): DemoState {
  if (!state.classes.some((c) => c.id === id && c.schoolId === state.school.id))
    throw new Error('Class not found.');
  if (state.classes.filter((c) => c.schoolId === state.school.id).length <= 1)
    throw new Error('Keep at least one school class.');
  if (
    state.sections.some((s) => s.schoolId === state.school.id && s.classId === id) ||
    state.enrollments.some((e) => e.schoolId === state.school.id && e.classId === id) ||
    state.exams.some(
      (e) => e.schoolId === state.school.id && (e.classId === id || e.classIds?.includes(id)),
    )
  )
    throw new Error(
      'Remove unused sections first. Classes with student or exam records must be kept.',
    );
  return {
    ...state,
    classes: state.classes.filter((c) => c.schoolId !== state.school.id || c.id !== id),
  };
}
