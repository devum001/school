import { examIncludes } from './testScope';
import { z } from 'zod';
import type { ClassSubject, DemoState, ExamResult } from '../types/domain';

export const classSubjectSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(60),
  aliases: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
});
const key = (name: string) => name.trim().toLowerCase();

export function classSubjects(state: DemoState, classId: string): ClassSubject[] {
  const schoolClass = state.classes.find((c) => c.id === classId && c.schoolId === state.school.id);
  if (!schoolClass) return [];
  if (schoolClass.subjects) return schoolClass.subjects;
  const grade = Number((schoolClass.grade || schoolClass.name).match(/\d+/)?.[0] ?? 0);
  const names =
    grade && grade <= 2
      ? ['English', 'Hindi', 'Mathematics', 'Environmental Studies']
      : grade && grade <= 5
        ? ['Mathematics', 'Hindi', 'English', 'Environmental Studies', 'Computer']
        : ['Mathematics', 'Hindi', 'English', 'Science', 'Social Studies', 'Computer'];
  if (/icse|isc/i.test(state.school.board ?? '') && grade >= 9)
    names.splice(3, 2, 'Physics', 'Chemistry', 'Biology', 'History & Civics', 'Geography');
  // Keep subjects from existing records available when opening an older demo.
  for (const exam of state.exams.filter((e) => examIncludes(e, classId)))
    for (const subject of exam.subjects)
      if (!names.some((n) => key(n) === key(subject.name))) names.push(subject.name);
  return names.map((name) => ({ id: `${classId}:${key(name).replace(/[^a-z0-9]+/g, '-')}`, name }));
}

export function subjectName(
  state: DemoState,
  classId: string,
  subject: { subjectId?: string; name: string },
) {
  const subjects = classSubjects(state, classId);
  const byId = subject.subjectId ? subjects.find((s) => s.id === subject.subjectId) : undefined;
  return (
    byId?.name ??
    subjects.find(
      (s) =>
        key(s.name) === key(subject.name) || s.aliases?.some((n) => key(n) === key(subject.name)),
    )?.name ??
    subject.name
  );
}

export function resolvedResult(state: DemoState, result: ExamResult): ExamResult {
  const classId = state.enrollments.find((e) => e.id === result.enrollmentId)?.classId ?? '';
  return {
    ...result,
    subjects: result.subjects.map((s) => ({ ...s, name: subjectName(state, classId, s) })),
  };
}

export function saveClassSubjects(
  state: DemoState,
  classId: string,
  input: ClassSubject[],
): DemoState {
  if (!state.classes.some((c) => c.id === classId && c.schoolId === state.school.id))
    throw new Error('Class not found.');
  const parsed = z.array(classSubjectSchema).max(30).safeParse(input);
  if (!parsed.success)
    throw new Error('Enter a subject name (up to 60 characters). Add up to 30 subjects.');
  const subjects = parsed.data;
  const active = subjects.filter((s) => !s.archived);
  if (!active.length) throw new Error('Keep at least one subject.');
  if (
    new Set(subjects.map((s) => s.id)).size !== subjects.length ||
    new Set(active.map((s) => key(s.name))).size !== active.length
  )
    throw new Error('Each subject needs a different name.');
  const previous = classSubjects(state, classId);
  const next = subjects.map((s) => {
    const old = previous.find((p) => p.id === s.id);
    return {
      ...s,
      aliases: [
        ...new Set([
          ...(old?.aliases ?? []),
          ...(s.aliases ?? []),
          ...(old && old.name !== s.name ? [old.name] : []),
        ]),
      ],
    };
  });
  // Archive omitted subjects so historical scores retain their identity.
  next.push(
    ...previous
      .filter((s) => !next.some((n) => n.id === s.id))
      .map((s) => ({ ...s, aliases: s.aliases ?? [], archived: true })),
  );
  return {
    ...state,
    classes: state.classes.map((c) => (c.id === classId ? { ...c, subjects: next } : c)),
  };
}
